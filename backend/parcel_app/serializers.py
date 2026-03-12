from rest_framework import serializers

from .models import Document, ExtractedConstraint, Jurisdiction, Parcel, Source


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


class DocumentCreateSerializer(serializers.ModelSerializer):
    jurisdiction_id = serializers.PrimaryKeyRelatedField(
        source="jurisdiction",
        queryset=Jurisdiction.objects.all(),
        required=True,
        error_messages={"required": "jurisdiction_id is required."},
    )
    source_id = serializers.PrimaryKeyRelatedField(
        source="source",
        queryset=Source.objects.all(),
        required=False,
        allow_null=True,
    )
    title = serializers.CharField(
        required=True,
        allow_blank=False,
        error_messages={"required": "title is required.", "blank": "title cannot be blank."},
    )
    document_type = serializers.ChoiceField(
        choices=Document.DocumentType.choices,
        required=True,
        error_messages={"required": "document_type is required."},
    )

    class Meta:
        model = Document
        fields = [
            "title",
            "document_type",
            "source_url",
            "file_path",
            "jurisdiction_id",
            "source_id",
            "status",
        ]
