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