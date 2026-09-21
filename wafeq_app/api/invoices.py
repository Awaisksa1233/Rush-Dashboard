"""
Wafeq Simplified Invoices API
"""
from typing import List, Dict, Any, Optional
from .client import WafeqClient

class InvoicesAPI:
    def __init__(self, client: WafeqClient):
        self.client = client

    def list_invoices(self, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """List simplified invoices with optional query parameters"""
        return self.client.get_all_pages("simplified-invoices", params=params)

    def get_invoice(self, invoice_id: str) -> Dict[str, Any]:
        """Get simplified invoice by ID"""
        return self.client.get(f"simplified-invoices/{invoice_id}")

    def create_invoice(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new simplified invoice (B2C)"""
        return self.client.post("simplified-invoices", data)

    def update_invoice(self, invoice_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing simplified invoice"""
        return self.client.patch(f"simplified-invoices/{invoice_id}", data)

    def delete_invoice(self, invoice_id: str) -> bool:
        """Delete an invoice"""
        return self.client.delete(f"simplified-invoices/{invoice_id}")

    def download_pdf(self, invoice_id: str) -> bytes:
        """Download invoice PDF binary"""
        return self.client.download_file(f"simplified-invoices/{invoice_id}/download")

    def report_to_zatca(self, invoice_id: str) -> Dict[str, Any]:
        """Report simplified invoice to ZATCA (Saudi Tax Authority)"""
        return self.client.post(f"simplified-invoices/{invoice_id}/tax-authority/report")
