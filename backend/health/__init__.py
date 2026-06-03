"""
health — Lightweight health-check endpoints.

Provides /health/, /health/worker/, and /health/cache/ endpoints
for Docker HEALTHCHECK, load-balancer probes, and monitoring.
"""

default_app_config = 'health.apps.HealthConfig'
