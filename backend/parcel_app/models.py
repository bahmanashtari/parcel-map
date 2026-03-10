from django.contrib.gis.db import models


class Jurisdiction(models.Model):
    name = models.CharField(max_length=255)
    state = models.CharField(max_length=2, default="CA")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Source(models.Model):
    jurisdiction = models.ForeignKey(
        Jurisdiction,
        on_delete=models.CASCADE,
        related_name="sources"
    )
    name = models.CharField(max_length=255)
    source_type = models.CharField(max_length=64)
    url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Parcel(models.Model):
    jurisdiction = models.ForeignKey(
        Jurisdiction,
        on_delete=models.CASCADE,
        related_name="parcels"
    )
    source = models.ForeignKey(
        Source,
        on_delete=models.CASCADE,
        related_name="parcels"
    )
    apn = models.CharField(max_length=64, db_index=True, help_text="Assessor Parcel Number")
    address = models.TextField(blank=True, null=True)
    owner_name = models.TextField(blank=True, null=True)
    lot_size_sqft = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    land_use_code = models.CharField(max_length=64, blank=True, null=True)
    geom = models.MultiPolygonField(srid=4326, spatial_index=True)
    source_crs = models.CharField(max_length=64, blank=True, null=True)
    data_hash = models.CharField(max_length=64, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("source", "apn")
        indexes = [
            models.Index(fields=["apn"]),
        ]

    def __str__(self):
        return f"{self.apn} - {self.address or 'Parcel'}"


class Document(models.Model):
    class DocumentType(models.TextChoices):
        ZONING_CODE = "zoning_code", "Zoning Code"
        ORDINANCE = "ordinance", "Ordinance"
        PLAN = "plan", "Plan"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSED = "processed", "Processed"
        FAILED = "failed", "Failed"

    jurisdiction = models.ForeignKey(
        Jurisdiction,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    source = models.ForeignKey(
        Source,
        on_delete=models.SET_NULL,
        related_name="documents",
        blank=True,
        null=True,
    )
    title = models.CharField(max_length=255)
    document_type = models.CharField(
        max_length=32,
        choices=DocumentType.choices,
        default=DocumentType.OTHER,
    )
    source_url = models.URLField(blank=True, null=True)
    file_path = models.CharField(max_length=1024, blank=True, null=True)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.jurisdiction.name})"


class ExtractionRun(models.Model):
    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="extraction_runs",
    )
    extractor_name = models.CharField(max_length=128)
    model_name = models.CharField(max_length=128)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.RUNNING,
    )
    started_at = models.DateTimeField()
    completed_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    raw_response_text = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.document.title} - {self.extractor_name} ({self.status})"


class ExtractedRule(models.Model):
    class RuleType(models.TextChoices):
        SETBACK = "setback", "Setback"
        HEIGHT_LIMIT = "height_limit", "Height Limit"
        LOT_COVERAGE = "lot_coverage", "Lot Coverage"
        OTHER = "other", "Other"

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="extracted_rules",
    )
    extraction_run = models.ForeignKey(
        ExtractionRun,
        on_delete=models.CASCADE,
        related_name="extracted_rules",
    )
    rule_type = models.CharField(
        max_length=32,
        choices=RuleType.choices,
        default=RuleType.OTHER,
    )
    value_text = models.TextField()
    unit = models.CharField(max_length=32, blank=True, null=True)
    applies_to = models.CharField(max_length=255, blank=True, null=True)
    confidence = models.DecimalField(max_digits=5, decimal_places=4, blank=True, null=True)
    citation_text = models.TextField()
    page_number = models.PositiveIntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_rule_type_display()} - {self.document.title}"
