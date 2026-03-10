from decimal import Decimal

from django.utils import timezone

from parcel_app.models import Document, ExtractedRule, ExtractionRun


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

        rule = ExtractedRule.objects.create(
            document=document,
            extraction_run=extraction_run,
            rule_type=ExtractedRule.RuleType.HEIGHT_LIMIT,
            value_text="35",
            unit="ft",
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
