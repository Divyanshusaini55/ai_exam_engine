from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.contrib.auth import logout
from .models import UserSettings
from .serializers_settings import FullSettingsSerializer


class SettingsView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FullSettingsSerializer

    def get_object(self):
        # Ensure UserSettings exists
        UserSettings.objects.get_or_create(user=self.request.user)
        return self.request.user

class ExportDataView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        # Collect data
        data = {
            "account": {
                "username": user.username,
                "email": user.email,
                "date_joined": user.date_joined
            },
            "profile": {
                "xp": user.profile.xp,
                "streak": user.profile.streak
            },
            "history": list(user.exam_results.values(
                'exam__title', 'score', 'percentage', 'completed_at'
            )),
            "contributions": list(user.activities.values(
                'activity_type', 'description', 'created_at'
            ))
        }
        
        return Response(data, status=status.HTTP_200_OK)

class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        confirmation = request.data.get("confirmation", "")
        if confirmation != "DELETE_ACCOUNT":
            return Response(
                {"error": "Please type DELETE_ACCOUNT to confirm."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        user.is_active = False # Soft delete
        user.save()
        
        # Log out the user
        logout(request)
        
        return Response({"message": "Account deleted successfully."}, status=status.HTTP_200_OK)
