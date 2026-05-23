from rest_framework import serializers

class ConceptSerializer(serializers.Serializer):
    concept = serializers.CharField(max_length=200)
    subject = serializers.CharField(max_length=100)
    frequency = serializers.IntegerField(min_value=1)
    confidence = serializers.FloatField(min_value=0.0, max_value=1.0)

class FormulaSerializer(serializers.Serializer):
    formula = serializers.CharField(max_length=500)
    shortcut = serializers.CharField(max_length=500, required=False, allow_blank=True, allow_null=True)
    usage = serializers.CharField(max_length=1000)
    subject = serializers.CharField(max_length=100)
    topic = serializers.CharField(max_length=100)
    confidence = serializers.FloatField(min_value=0.0, max_value=1.0)
