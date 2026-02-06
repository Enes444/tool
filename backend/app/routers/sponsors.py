from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..db import get_session
from ..deps import get_current_user, get_current_org_id, require_org_role
from ..models import Sponsor, Organization, Deal
from ..schemas import SponsorCreate, SponsorUpdate

router = APIRouter(prefix="/api/sponsors", tags=["sponsors"])

@router.get("/")
def list_sponsors(
    include_archived: bool = Query(False),
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
    org_id: int = Depends(get_current_org_id),
):
    require_org_role(session, user, org_id, min_role="viewer")
    q = select(Sponsor).where(Sponsor.organization_id == org_id)
    if not include_archived:
        q = q.where(Sponsor.archived_at.is_(None))
    return session.exec(q.order_by(Sponsor.name.asc())).all()

@router.post("/")
def create_sponsor(payload: SponsorCreate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    org = session.get(Organization, payload.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    require_org_role(session, user, payload.organization_id, min_role="editor")
    s = Sponsor(organization_id=payload.organization_id, name=payload.name, contact_email=payload.contact_email)
    s.portal_token_expires_at = datetime.utcnow() + timedelta(days=180)
    session.add(s); session.commit(); session.refresh(s)
    return s

@router.get("/{sponsor_id}")
def get_sponsor(sponsor_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    s = session.get(Sponsor, sponsor_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    require_org_role(session, user, s.organization_id, min_role="viewer")
    return s

@router.patch("/{sponsor_id}")
def update_sponsor(sponsor_id: int, payload: SponsorUpdate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    s = session.get(Sponsor, sponsor_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    require_org_role(session, user, s.organization_id, min_role="editor")
    data = payload.model_dump(exclude_unset=True)
    for k,v in data.items():
        setattr(s, k, v)
    session.add(s); session.commit(); session.refresh(s)
    return s

@router.post("/{sponsor_id}/archive")
def archive_sponsor(sponsor_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    s = session.get(Sponsor, sponsor_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    require_org_role(session, user, s.organization_id, min_role="editor")
    if s.archived_at is None:
        s.archived_at = datetime.utcnow()
        session.add(s); session.commit()
    return {"ok": True}

@router.post("/{sponsor_id}/restore")
def restore_sponsor(sponsor_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    s = session.get(Sponsor, sponsor_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    require_org_role(session, user, s.organization_id, min_role="editor")
    if s.archived_at is not None:
        s.archived_at = None
        session.add(s); session.commit()
    return {"ok": True}

@router.get("/{sponsor_id}/deals")
def list_deals(
    sponsor_id: int,
    include_archived: bool = Query(False),
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    s = session.get(Sponsor, sponsor_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    require_org_role(session, user, s.organization_id, min_role="viewer")
    q = select(Deal).where(Deal.sponsor_id == sponsor_id)
    if not include_archived:
        q = q.where(Deal.archived_at.is_(None))
    return session.exec(q.order_by(Deal.start_date.desc())).all()