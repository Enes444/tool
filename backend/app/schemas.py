from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional, List

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: str
    password: str

class OrganizationCreate(BaseModel):
    name: str


class OrganizationUpdate(BaseModel):
    name: str

class SponsorUpdate(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None


class MemberInvite(BaseModel):
    email: str
    role: str = "manager"
    temp_password: Optional[str] = None

class SponsorCreate(BaseModel):
    organization_id: int
    name: str
    contact_email: Optional[str] = None

class DealCreate(BaseModel):
    sponsor_id: int
    name: str
    start_date: date
    end_date: date
    total_value: Optional[float] = None
    guarantee_cap_pct: float = 0.0
    cure_days: int = 0
    notes: Optional[str] = None


class DealRead(DealCreate):
    """Read model for Deals.

    Some routes (archive/delete/undo/status endpoints) use response models.
    This keeps FastAPI/Pydantic happy and makes the API self-describing.
    """

    id: int
    organization_id: int
    sponsor_id: Optional[int] = None
    status: str
    completed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    # Sponsor portal access token (if used)
    portal_token: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
    guarantee_cap_pct: float = 0.0
    cure_days: int = 0

class DealUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    total_value: Optional[float] = None
    guarantee_cap_pct: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None  # active|archived (pilot)
    archived_at: Optional[datetime] = None

class DeliverableCreate(BaseModel):
    deal_id: int
    title: str
    type: str
    due_date: date
    owner: Optional[str] = None
    assignee_user_id: Optional[int] = None
    sponsor_approval_required: bool = False
    guaranteed: bool = False
    value: Optional[float] = None
    brief: Optional[str] = None

class DeliverableUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    due_date: Optional[date] = None


class DeliverableRead(DeliverableCreate):
    id: int
    deal_id: int
    status: str
    proof_filename: Optional[str] = None
    proof_mime: Optional[str] = None
    proof_uploaded_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
    status: Optional[str] = None
    owner: Optional[str] = None
    assignee_user_id: Optional[int] = None
    sponsor_approval_required: Optional[bool] = None
    sponsor_approved_at: Optional[datetime] = None
    sponsor_approved_by: Optional[str] = None
    guaranteed: Optional[bool] = None
    value: Optional[float] = None
    brief: Optional[str] = None
    delivered_override_note: Optional[str] = None

class ProofCreate(BaseModel):
    deliverable_id: int
    kind: str = "link"
    url: Optional[str] = None
    note: Optional[str] = None

class BrandKitUpdate(BaseModel):
    guidelines_md: str = ""
    hashtags: List[str] = []
    required_tags: List[str] = []
    do: List[str] = []
    dont: List[str] = []
    assets: List[dict] = []

class CommentCreate(BaseModel):
    body: str

class TicketCreate(BaseModel):
    sponsor_token: str
    subject: str
    body: str
    deal_token: Optional[str] = None

class TicketReply(BaseModel):
    message: str


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    status: Optional[str] = None  # open|pending|closed
    priority: Optional[str] = None  # low|normal|high|urgent


class ClaimCreate(BaseModel):
    deal_token: str
    deliverable_id: int
    reason: str
    description: Optional[str] = None

class ClaimDecision(BaseModel):
    status: str


class ClaimUpdate(BaseModel):
    status: Optional[str] = None  # submitted|approved|denied|paid
    payout_type: Optional[str] = None
    payout_amount: Optional[float] = None
    notes: Optional[str] = None

    payout_type: Optional[str] = None
    payout_amount: Optional[float] = None
    notes: Optional[str] = None

class MarkRead(BaseModel):
    ids: List[int]

class ApplyTemplate(BaseModel):
    template: str = "valorant_standard"

class PortalTicketReply(BaseModel):
    sponsor_token: str
    deal_token: Optional[str] = None
    message: str

class PortalTicketGet(BaseModel):
    sponsor_token: str
    deal_token: Optional[str] = None

class PortalDeliverableApprove(BaseModel):
    deal_token: str
    approved_by: Optional[str] = None

class PortalDeliverableComment(BaseModel):
    deal_token: str
    author: Optional[str] = None
    body: str

class PortalProofLink(BaseModel):
    deal_token: str
    url: str
    note: Optional[str] = None