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
    """Map arbitrary model output to valid ExtractedRule rule_type choices."""
    if not rule_type:
        return ExtractedRule.RuleType.OTHER

    value = str(rule_type).strip().lower().replace(" ", "_")
    valid_values = {choice for choice, _ in ExtractedRule.RuleType.choices}
    if value in valid_values:
        return value

    return ExtractedRule.RuleType.OTHER


def run_ollama_rule_extraction(
    document_id: int,
    source_text: str,
    page_number: int | None = None,
    model_name: str = "qwen3:4b",
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
            },
            timeout=120,
        )
        response.raise_for_status()

        response_payload = response.json()
        raw_model_output = str(response_payload.get("response", "")).strip()
        parsed = _extract_json_object(raw_model_output)

        rule = ExtractedRule.objects.create(
            document=document,
            extraction_run=extraction_run,
            rule_type=_normalize_rule_type(parsed.get("rule_type")),
            value_text=str(parsed.get("value_text", "unknown")),
            unit=(str(parsed.get("unit")).strip() if parsed.get("unit") not in (None, "") else None),
            applies_to=(
                str(parsed.get("applies_to")).strip()
                if parsed.get("applies_to") not in (None, "")
                else None
            ),
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
