"""
Wafeq Contacts API
"""
from typing import List, Dict, Any, Optional
from .client import WafeqClient

class ContactsAPI:
    def __init__(self, client: WafeqClient):
        self.client = client

    def list_contacts(self) -> List[Dict[str, Any]]:
        """List all contacts (customers and suppliers)"""
        return self.client.get_all_pages("contacts")

    def get_contact(self, contact_id: str) -> Dict[str, Any]:
        """Get contact details by ID"""
        return self.client.get(f"contacts/{contact_id}")

    def create_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new contact"""
        return self.client.post("contacts", contact_data)

    def update_contact(self, contact_id: str, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """Partially update an existing contact"""
        return self.client.patch(f"contacts/{contact_id}", contact_data)

    def delete_contact(self, contact_id: str) -> bool:
        """Delete a contact"""
        return self.client.delete(f"contacts/{contact_id}")
