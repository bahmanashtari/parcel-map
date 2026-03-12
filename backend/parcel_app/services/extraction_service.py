import json
import re
from decimal import Decimal

import requests
from django.utils import timezone

from parcel_app.models import Document, ExtractedRule, ExtractionRun


def _parse_height_limit(source_text: str) -> tuple[str, str | None]:
    """Extract a height value in feet from source text, with a safe fallback."""
    match = re.search(
        r"\bheight\b[^0-9]{0,30}(\d+(?:\.\d+)?)\s*(?:feet|ft)\b",
        source_text,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1), "ft"

    return "unknown", None


def run_manual_rule_extraction(
    document_id: int,
    source_text: str,
    page_number: int | None = None,
) -> dict:
    """Create a manual test extraction run and one sample extracted rule from input text."""
    extraction_run = None

    try:
        document = Document.objects.get(id=document_id)
        started_at = timezone.now()

        extraction_run = ExtractionRun.objects.create(
            document=document,
            extractor_name="manual_rule_extractor",
            model_name="manual-test",
            status=ExtractionRun.Status.RUNNING,
            started_at=started_at,
        )
        parsed_value_text, parsed_unit = _parse_height_limit(source_text)

        rule = ExtractedRule.objects.create(
            document=document,
            extraction_run=extraction_run,
            rule_type=ExtractedRule.RuleType.HEIGHT_LIMIT,
            value_text=parsed_value_text,
            unit=parsed_unit,
            applies_to="sample zone",
            confidence=Decimal("0.95"),
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
            extraction_run.status = ExtractionRun.Status.FAILED
            extraction_run.completed_at = timezone.now()
            extraction_run.error_message = str(exc)
            extraction_run.save(update_fields=["status", "completed_at", "error_message"])

        return {
            "ok": False,
            "document_id": document_id,
            "extraction_run_id": extraction_run.id if extraction_run is not None else None,
            "error": str(exc),
        }


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
    """Normalize rule_type to the currently allowed extraction categories."""
    if not rule_type:
        return "unknown"

    normalized = str(rule_type).strip().lower().replace("-", "_").replace(" ", "_")
    allowed = {
        "height_limit",
        "front_setback",
        "rear_setback",
        "side_setback",
        "unknown",
    }
    return normalized if normalized in allowed else "unknown"


def _normalize_unit(unit: str | None) -> str | None:
    """Normalize common unit variants for consistent storage."""
    if unit in (None, ""):
        return None

    normalized = str(unit).strip().lower()
    if normalized in {"feet", "foot", "ft"}:
        return "ft"

    return normalized


def _normalize_extracted_rule_data(parsed: dict) -> dict:
    """Validate and normalize parsed LLM output for ExtractedRule creation."""
    value_text_raw = parsed.get("value_text")
    value_text = str(value_text_raw).strip() if value_text_raw is not None else ""
    if not value_text:
        value_text = "unknown"

    applies_to_raw = parsed.get("applies_to")
    applies_to = str(applies_to_raw).strip() if applies_to_raw is not None else ""
    if not applies_to:
        applies_to = None

    return {
        "rule_type": _normalize_rule_type(parsed.get("rule_type")),
        "value_text": value_text,
        "unit": _normalize_unit(parsed.get("unit")),
        "applies_to": applies_to,
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
            "Extract one zoning rule from the text below.\n"
            "Return JSON only. Do not include markdown, code fences, or explanations.\n"
            "Use exactly this JSON shape:\n"
            '{"rule_type":"...","value_text":"...","unit":"...","applies_to":"..."}\n\n'
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
