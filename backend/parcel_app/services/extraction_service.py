import json
import re
from typing import Any

import requests
from django.utils import timezone

from parcel_app.models import Document, ExtractedRule, ExtractionRun


def _extract_json_object(text: str) -> dict:
    """Parse a JSON object from model text output."""
    cleaned = text.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _normalize_rule_type(rule_type: str | None) -> str:
    """Map model rule output to the current ExtractedRule choices."""
    if not rule_type:
        return ExtractedRule.RuleType.OTHER

    normalized = str(rule_type).strip().lower().replace("-", "_").replace(" ", "_")
    if normalized == "height_limit":
        return ExtractedRule.RuleType.HEIGHT_LIMIT
    if normalized in {"front_setback", "rear_setback", "side_setback", "setback"}:
        return ExtractedRule.RuleType.SETBACK
    if normalized == "lot_coverage":
        return ExtractedRule.RuleType.LOT_COVERAGE
    return ExtractedRule.RuleType.OTHER


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _format_number(value: float) -> str:
    if value.is_integer():
        return str(int(value))
    return f"{value:.4f}".rstrip("0").rstrip(".")


def _normalize_value_and_unit(value_number: Any, value_unit: Any) -> tuple[str, str | None]:
    """Normalize dimensional values to feet with ft unit."""
    if value_number is None or value_unit is None:
        return "unknown", None

    try:
        if isinstance(value_number, str):
            numeric_value = float(value_number.strip().replace(",", ""))
        else:
            numeric_value = float(value_number)
    except (TypeError, ValueError):
        return "unknown", None

    normalized_unit = str(value_unit).strip().lower()
    if normalized_unit in {"ft", "foot", "feet"}:
        feet_value = numeric_value
    elif normalized_unit in {"m", "meter", "meters"}:
        feet_value = numeric_value * 3.28084
    else:
        return "unknown", None

    return _format_number(feet_value), "ft"


def _format_parcel_hints(parcel_hints: Any) -> str | None:
    """Build compact parcel hint text from optional model output."""
    if not isinstance(parcel_hints, dict):
        return None

    compact_parts: list[str] = []
    for key in ("apn", "address", "lot_size_sqft", "land_use_code"):
        value = _normalize_text(parcel_hints.get(key))
        if value:
            compact_parts.append(f"{key}={value}")

    if not compact_parts:
        return None
    return ", ".join(compact_parts)


def _normalize_extracted_rule_data(parsed: dict[str, Any]) -> dict[str, str | None]:
    """Validate and normalize parsed LLM output for ExtractedRule creation."""
    value_text, unit = _normalize_value_and_unit(parsed.get("value_number"), parsed.get("value_unit"))
    applies_parts: list[str] = []

    applies_to = _normalize_text(parsed.get("applies_to"))
    if applies_to:
        applies_parts.append(applies_to)

    key_term = _normalize_text(parsed.get("key_term"))
    if key_term:
        applies_parts.append(f"key_term: {key_term}")

    parcel_hints_summary = _format_parcel_hints(parsed.get("parcel_hints"))
    if parcel_hints_summary:
        applies_parts.append(f"parcel_hints: {parcel_hints_summary}")

    return {
        "rule_type": _normalize_rule_type(parsed.get("rule_type")),
        "value_text": value_text,
        "unit": unit,
        "applies_to": " | ".join(applies_parts) if applies_parts else None,
    }


def run_ollama_rule_extraction(
    document_id: int,
    source_text: str,
    page_number: int | None = None,
    model_name: str = "qwen3:30b",
) -> dict:
    """Run one Ollama extraction call and persist a single extracted rule."""
    extraction_run = None
    raw_model_output = None

    try:
        document = Document.objects.get(id=document_id)
        started_at = timezone.now()

        extraction_run = ExtractionRun.objects.create(
            document=document,
            extractor_name="ollama_rule_extractor",
            model_name=model_name,
            status=ExtractionRun.Status.RUNNING,
            started_at=started_at,
        )

        prompt = (
            "Extract one parcel-related regulatory constraint from the text below.\n"
            "Return JSON only. Do not include markdown, code fences, or explanations.\n"
            "Use exactly this JSON shape:\n"
            "{"
            '"rule_type":"...",'
            '"key_term":"...",'
            '"value_number":0,'
            '"value_unit":"...",'
            '"applies_to":"...",'
            '"parcel_hints":{"apn":"...","address":"...","lot_size_sqft":"...","land_use_code":"..."}'
            "}\n"
            "Prefer parcel-relevant constraints and parcel attribute hints.\n"
            "Use numeric value_number when possible.\n"
            f"Text:\n{source_text}"
        )

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": model_name,
                "prompt": prompt,
                "stream": False,
                "think": False,
            },
            timeout=120,
        )
        response.raise_for_status()

        response_payload = response.json()
        raw_model_output = str(response_payload.get("response", "")).strip()
        extraction_run.raw_response_text = raw_model_output or None
        extraction_run.save(update_fields=["raw_response_text"])
        parsed = _extract_json_object(raw_model_output)
        normalized = _normalize_extracted_rule_data(parsed)

        rule = ExtractedRule.objects.create(
            document=document,
            extraction_run=extraction_run,
            rule_type=normalized["rule_type"],
            value_text=normalized["value_text"],
            unit=normalized["unit"],
            applies_to=normalized["applies_to"],
            confidence=None,
            citation_text=source_text,
            page_number=page_number,
        )

        extraction_run.status = ExtractionRun.Status.COMPLETED
        extraction_run.completed_at = timezone.now()
        extraction_run.error_message = None
        extraction_run.save(update_fields=["status", "completed_at", "error_message"])

        return {
            "ok": True,
            "document_id": document.id,
            "extraction_run_id": extraction_run.id,
            "extracted_rule_id": rule.id,
        }
    except Exception as exc:
        if extraction_run is not None:
            error_message = str(exc)
            if raw_model_output:
                error_message = f"{error_message}\nRaw model output: {raw_model_output}"
            extraction_run.status = ExtractionRun.Status.FAILED
            extraction_run.completed_at = timezone.now()
            extraction_run.error_message = error_message
            extraction_run.save(update_fields=["status", "completed_at", "error_message"])

        return {
            "ok": False,
            "document_id": document_id,
            "extraction_run_id": extraction_run.id if extraction_run is not None else None,
            "error": str(exc),
        }
