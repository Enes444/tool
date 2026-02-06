from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime, date
import secrets

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    role: str = Field(default="admin")  # admin|superadmin

class Organization(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    sponsors: List["Sponsor"] = Relationship(back_populates="organization")
    members: List["OrganizationMember"] = Relationship(back_populates="organization")

class OrganizationMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: int = Field(foreign_key="organization.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    role: str = Field(default="manager")  # viewer|editor|manager|org_admin
    created_at: datetime = Field(default_factory=datetime.utcnow)
    organization: Optional[Organization] = Relationship(back_populates="members")

class Sponsor(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: int = Field(foreign_key="organization.id", index=True)
    name: str
    contact_email: Optional[str] = None
    archived_at: Optional[datetime] = None
    portal_token: str = Field(default_factory=lambda: secrets.token_urlsafe(16), index=True, unique=True)
    portal_token_revoked: bool = Field(default=False)
    portal_token_expires_at: Optional[datetime] = None
    organization: Optional[Organization] = Relationship(back_populates="sponsors")
    deals: List["Deal"] = Relationship(back_populates="sponsor")
    tickets: List["Ticket"] = Relationship(back_populates="sponsor")

class Deal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: int = Field(index=True)
    sponsor_id: int = Field(foreign_key="sponsor.id", index=True)
    name: str
    start_date: date
    end_date: date
    total_value: Optional[float] = None
    status: str = Field(default="draft", index=True)
    completed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    guarantee_cap_pct: float = Field(default=0.0)
    cure_days: int = Field(default=0)
    portal_token: str = Field(default_factory=lambda: secrets.token_urlsafe(16), index=True, unique=True)
    portal_token_revoked: bool = Field(default=False)
    portal_token_expires_at: Optional[datetime] = None
    sponsor: Optional[Sponsor] = Relationship(back_populates="deals")
    deliverables: List["Deliverable"] = Relationship(back_populates="deal")
    claims: List["Claim"] = Relationship(back_populates="deal")
    tickets: List["Ticket"] = Relationship(back_populates="deal")
    brandkit: Optional["BrandKit"] = Relationship(back_populates="deal")

class BrandKit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    deal_id: int = Field(foreign_key="deal.id", index=True, unique=True)
    guidelines_md: str = Field(default="")
    hashtags_json: str = Field(default="[]")
    required_tags_json: str = Field(default="[]")
    do_json: str = Field(default="[]")
    dont_json: str = Field(default="[]")
    assets_json: str = Field(default="[]")
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deal: Optional[Deal] = Relationship(back_populates="brandkit")

class Deliverable(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    deal_id: int = Field(foreign_key="deal.id", index=True)
    title: str
    type: str
    due_date: date
    status: str = Field(default="draft", index=True)
    archived_at: Optional[datetime] = None
    canceled_at: Optional[datetime] = None
    canceled_by: Optional[str] = None
    delivered_at: Optional[datetime] = None
    delivered_by: Optional[str] = None
    delivered_override_note: Optional[str] = None
    owner: Optional[str] = None
    assignee_user_id: Optional[int] = Field(default=None, index=True)
    sponsor_approval_required: bool = Field(default=False)
    sponsor_approved_at: Optional[datetime] = None
    sponsor_approved_by: Optional[str] = None
    guaranteed: bool = Field(default=False)
    value: Optional[float] = None
    brief: Optional[str] = None
    deal: Optional[Deal] = Relationship(back_populates="deliverables")
    proofs: List["Proof"] = Relationship(back_populates="deliverable")
    comments: List["DeliverableComment"] = Relationship(back_populates="deliverable")

class Proof(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    deliverable_id: int = Field(foreign_key="deliverable.id", index=True)
    kind: str = Field(default="link")  # link|file
    url: Optional[str] = None
    note: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    mime_type: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deliverable: Optional[Deliverable] = Relationship(back_populates="proofs")

class DeliverableComment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    deliverable_id: int = Field(foreign_key="deliverable.id", index=True)
    author: str
    body: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deliverable: Optional[Deliverable] = Relationship(back_populates="comments")

class Ticket(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: int = Field(index=True)
    sponsor_id: int = Field(foreign_key="sponsor.id", index=True)
    deal_id: Optional[int] = Field(default=None, foreign_key="deal.id", index=True)
    subject: str
    body: str
    status: str = Field(default="open", index=True)
    priority: str = Field(default="normal")
    sla_due_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    archived_at: Optional[datetime] = None
    last_reply_at: Optional[datetime] = None
    sponsor: Optional[Sponsor] = Relationship(back_populates="tickets")
    deal: Optional[Deal] = Relationship(back_populates="tickets")
    messages: List["TicketMessage"] = Relationship(back_populates="ticket")

class TicketMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="ticket.id", index=True)
    sender: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    ticket: Optional[Ticket] = Relationship(back_populates="messages")

class Claim(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: int = Field(index=True)
    deal_id: int = Field(foreign_key="deal.id", index=True)
    deliverable_id: int = Field(foreign_key="deliverable.id", index=True)
    reason: str
    description: Optional[str] = None
    status: str = Field(default="submitted")
    payout_type: Optional[str] = None
    payout_amount: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    archived_at: Optional[datetime] = None
    deal: Optional[Deal] = Relationship(back_populates="claims")

class Activity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: int = Field(index=True)
    deal_id: Optional[int] = Field(default=None, index=True)
    entity_type: str
    entity_id: Optional[int] = None
    action: str
    summary: str
    actor: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: int = Field(index=True)
    user_id: int = Field(index=True)
    kind: str
    title: str
    body: str
    link: Optional[str] = None
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    canceled_at: Optional[datetime] = None
    canceled_by: Optional[str] = None