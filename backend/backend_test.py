import os
import django
import sys

# Add backend dir to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
from quiz.api import ExamRoadmapViewSet
from quiz.models import SubCategory, RoadmapTopic, UserTopicProgress, TopicResource, ResourceBookmark, ResourceProgress

# Find a subcategory slug
sub = SubCategory.objects.first()
if not sub:
    print("No subcategory found in database")
    sys.exit(0)

print(f"Testing subcategory: {sub.slug}")

user = User.objects.first()
if not user:
    print("No user found in database")
    sys.exit(0)

# Make sure we have topics and resources
topic = RoadmapTopic.objects.filter(phase__roadmap__subcategory=sub).first()
if not topic:
    print("No RoadmapTopic found, creating one...")
    from quiz.models import ExamRoadmap, RoadmapPhase
    roadmap, _ = ExamRoadmap.objects.get_or_create(subcategory=sub, defaults={'title': 'Test Roadmap'})
    phase, _ = RoadmapPhase.objects.get_or_create(roadmap=roadmap, title='Test Phase', defaults={'order': 0})
    topic = RoadmapTopic.objects.create(phase=phase, title='Test Topic', order=0)

# Create a TopicResource if none exists
resource = TopicResource.objects.filter(topic=topic).first()
if not resource:
    print("No TopicResource found, creating one...")
    resource = TopicResource.objects.create(
        topic=topic,
        title="Test Resource",
        is_published=True
    )

print(f"Creating mock user records for user: {user.username}")
# Create UserTopicProgress
UserTopicProgress.objects.get_or_create(
    user=user,
    topic=topic,
    defaults={'status': 'in_progress'}
)

# Create ResourceBookmark
ResourceBookmark.objects.get_or_create(
    user=user,
    resource=resource
)

# Create ResourceProgress
ResourceProgress.objects.get_or_create(
    user=user,
    resource=resource,
    defaults={'is_completed': True}
)

# Create request
factory = APIRequestFactory()
view = ExamRoadmapViewSet.as_view({'get': 'retrieve'})

# Test authenticated request
print(f"Testing authenticated request with user: {user.username}")
request = factory.get(f'/api/roadmaps/{sub.slug}/')
force_authenticate(request, user=user)
try:
    response = view(request, subcategory__slug=sub.slug)
    print(f"Authenticated response status code: {response.status_code}")
    if response.status_code == 200:
        print("Success! Serialized data structure:")
        # Just check that it has phases and topic_resources
        data = response.data
        print(f"Roadmap Title: {data.get('title')}")
        phases = data.get('phases', [])
        if phases:
            topics = phases[0].get('topics', [])
            if topics:
                print(f"Topic Status: {topics[0].get('status')}")
                print(f"Topic Resources: {topics[0].get('topic_resources')}")
except Exception as e:
    import traceback
    print("Authenticated request failed with exception:")
    traceback.print_exc()
