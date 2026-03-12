from rest_framework import serializers

from .models import ExtractedConstraint, Parcel


class ParcelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parcel
        fields = [
            "id",
            "apn",
            "address",
            "owner_name",
            "lot_size_sqft",
            "land_use_code",
        ]


class ExtractedConstraintSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractedConstraint
        fields = [
            "id",
            "constraint_type",
            "value_text",
            "unit",
            "applies_to",
            "citation_text",
            "page_number",
            "created_at",
        ]
