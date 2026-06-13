from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile, UserSettings
from quiz.models import SubCategory
import base64
import uuid
from django.core.files.base import ContentFile

class Base64ImageField(serializers.ImageField):
    def to_internal_value(self, data):
        if isinstance(data, str):
            if data.startswith('data:image'):
                format, imgstr = data.split(';base64,') 
                ext = format.split('/')[-1]
                id = uuid.uuid4()
                data = ContentFile(base64.b64decode(imgstr), name=f'{id}.{ext}')
            elif data.startswith('http') or data.startswith('/media/'):
                from rest_framework.fields import SkipField
                raise SkipField()
        return super().to_internal_value(data)


class UserSettingsSerializer(serializers.ModelSerializer):
    primary_exam = serializers.PrimaryKeyRelatedField(
        queryset=SubCategory.objects.all(), 
        allow_null=True,
        required=False
    )
    secondary_exams = serializers.PrimaryKeyRelatedField(
        queryset=SubCategory.objects.all(), 
        many=True,
        required=False
    )

    class Meta:
        model = UserSettings
        exclude = ('user', 'id')

class UserSettingsProfileSerializer(serializers.ModelSerializer):
    avatar_image = Base64ImageField(required=False, allow_null=True)

    class Meta:
        model = Profile
        fields = ('bio', 'full_name', 'show_profile_pic', 'avatar_char', 'avatar_image', 'xp', 'streak', 'community_rank')
        read_only_fields = ('avatar_char', 'xp', 'streak', 'community_rank')

class UserSettingsAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('username', 'email')

class FullSettingsSerializer(serializers.Serializer):
    account = UserSettingsAccountSerializer(source='*')
    profile = UserSettingsProfileSerializer()
    preferences = UserSettingsSerializer(source='settings')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields['account'].instance = self.instance

    def update(self, instance, validated_data):
        # Update User (account)
        if 'username' in validated_data:
            instance.username = validated_data['username']
        if 'email' in validated_data:
            instance.email = validated_data['email']
        instance.save()
        
        # Update Profile
        if 'profile' in validated_data:
            profile_data = validated_data['profile']
            profile = instance.profile
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        # Update UserSettings
        if 'settings' in validated_data:
            settings_data = validated_data['settings']
            settings, _ = UserSettings.objects.get_or_create(user=instance)
            
            if 'secondary_exams' in settings_data:
                settings.secondary_exams.set(settings_data.pop('secondary_exams'))
            
            for attr, value in settings_data.items():
                setattr(settings, attr, value)
            settings.save()
            
        return instance
