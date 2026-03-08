from rest_framework import serializers

from .models import Parcel


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
