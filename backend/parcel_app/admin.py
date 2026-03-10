from django.contrib import admin

from .models import (
    Document,
    ExtractedRule,
    ExtractionRun,
    Jurisdiction,
    Parcel,
    Source,
)

admin.site.register(Jurisdiction)
admin.site.register(Source)
admin.site.register(Parcel)


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "jurisdiction", "document_type", "status", "created_at")
    list_filter = ("document_type", "status", "jurisdiction")
    search_fields = ("title", "source_url", "file_path")


@admin.register(ExtractionRun)
class ExtractionRunAdmin(admin.ModelAdmin):
    list_display = ("document", "extractor_name", "model_name", "status", "started_at", "completed_at")
    list_filter = ("status", "extractor_name", "model_name")
    search_fields = ("document__title", "extractor_name", "model_name", "error_message")


@admin.register(ExtractedRule)
class ExtractedRuleAdmin(admin.ModelAdmin):
    list_display = ("document", "extraction_run", "rule_type", "confidence", "page_number", "created_at")
    list_filter = ("rule_type", "document__jurisdiction")
    search_fields = ("document__title", "value_text", "citation_text", "applies_to")
