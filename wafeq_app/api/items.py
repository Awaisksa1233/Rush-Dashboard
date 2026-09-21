"""
Wafeq Items / Products API
"""
from typing import List, Dict, Any, Optional
from .client import WafeqClient

class ItemsAPI:
    def __init__(self, client: WafeqClient):
        self.client = client

    def list_items(self) -> List[Dict[str, Any]]:
        """List all items / products in catalog"""
        return self.client.get_all_pages("items")

    def get_item(self, item_id: str) -> Dict[str, Any]:
        """Get item details by ID"""
        return self.client.get(f"items/{item_id}")

    def create_item(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new item / product"""
        return self.client.post("items", data)

    def update_item(self, item_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing item"""
        return self.client.patch(f"items/{item_id}", data)

    def delete_item(self, item_id: str) -> bool:
        """Delete an item"""
        return self.client.delete(f"items/{item_id}")
