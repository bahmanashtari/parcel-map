from rest_framework import serializers

from .models import Document, ExtractedConstraint, Parcel


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


class DocumentListSerializer(serializers.ModelSerializer):
    jurisdiction_name = serializers.CharField(source="jurisdiction.name", read_only=True)
    constraint_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "document_type",
            "status",
            "created_at",
            "jurisdiction_name",
            "constraint_count",
        ]
