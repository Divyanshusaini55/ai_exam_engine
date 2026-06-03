from rest_framework.throttling import UserRateThrottle

class AIHeavyThrottle(UserRateThrottle):
    scope = 'ai_heavy'

class AILightThrottle(UserRateThrottle):
    scope = 'ai_light'
