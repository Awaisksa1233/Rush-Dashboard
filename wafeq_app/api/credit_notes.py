"""
Wafeq Credit Notes API
"""
from typing import List, Dict, Any, Optional
from .client import WafeqClient

class CreditNotesAPI:
    def __init__(self, client: WafeqClient):
        self.client = client

    def list_credit_notes(self, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """List credit notes"""
        return self.client.get_all_pages("credit-notes", params=params)

    def get_credit_note(self, credit_note_id: str) -> Dict[str, Any]:
        """Get credit note by ID"""
        return self.client.get(f"credit-notes/{credit_note_id}")

    def create_credit_note(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new credit note"""
        return self.client.post("credit-notes", data)

    def delete_credit_note(self, credit_note_id: str) -> bool:
        """Delete a credit note"""
        return self.client.delete(f"credit-notes/{credit_note_id}")

    def download_pdf(self, credit_note_id: str) -> bytes:
        """Download credit note PDF binary"""
        return self.client.download_file(f"credit-notes/{credit_note_id}/download")

    def report_to_zatca(self, credit_note_id: str) -> Dict[str, Any]:
        """Report credit note to ZATCA tax authority"""
        return self.client.post(f"credit-notes/{credit_note_id}/tax-authority/report")
