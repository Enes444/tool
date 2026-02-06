from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from ..db import get_session
from ..deps import get_current_user, require_org_role, org_id_for_deal
from ..models import Deliverable, Deal
from ..services import log_activity

router = APIRouter(prefix="/api/deliverables", tags=["deliverables"])

def _ensure_deliverable_access(session: Session, user, deliverable: Deliverable, min_role: str="viewer") -> int:
    deal = session.get(Deal, deliverable.deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    require_org_role(session, user, deal.organization_id, min_role=min_role)
    return deal.organization_id

@router.post("/{deliverable_id}/cancel")
def cancel(deliverable_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    d = session.get(Deliverable, deliverable_id)
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    org_id = _ensure_deliverable_access(session, user, d, "editor")
    if d.canceled_at is None:
        d.canceled_at = datetime.utcnow()
        d.canceled_by = user.email
    d.status = "canceled"
    session.add(d); session.commit(); session.refresh(d)
    log_activity(session, org_id, "deliverable", "canceled", f"Deliverable canceled: {d.title}", actor=user.email, deal_id=d.deal_id, entity_id=d.id)
    return d

@router.post("/{deliverable_id}/restore")
def restore(deliverable_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    d = session.get(Deliverable, deliverable_id)
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    org_id = _ensure_deliverable_access(session, user, d, "editor")
    d.archived_at = None
    d.canceled_at = None
    d.canceled_by = None
    if d.status == "canceled":
        d.status = "draft"
    session.add(d); session.commit(); session.refresh(d)
    log_activity(session, org_id, "deliverable", "restored", f"Deliverable restored: {d.title}", actor=user.email, deal_id=d.deal_id, entity_id=d.id)
    return d