"""
Wafeq Organization API
"""
from typing import Dict, Any
from .client import WafeqClient

class OrganizationAPI:
    def __init__(self, client: WafeqClient):
        self.client = client

    def get_organization(self) -> Dict[str, Any]:
        """Fetch details of the authenticated organization"""
        return self.client.get("organization")
