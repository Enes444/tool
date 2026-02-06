from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..db import get_session
from ..deps import get_current_user, get_current_org_id, require_org_role
from ..models import Claim
from ..schemas import ClaimDecision, ClaimUpdate

router = APIRouter(prefix="/api/claims", tags=["claims"])

_ALLOWED_STATUS = {"submitted", "approved", "denied", "paid"}

@router.get("/")
def list_claims(
    include_archived: bool = Query(False),
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
    org_id: int = Depends(get_current_org_id),
):
    require_org_role(session, user, org_id, "viewer")
    q = select(Claim).where(Claim.organization_id == org_id)
    if not include_archived:
        q = q.where(Claim.archived_at.is_(None))
    return session.exec(q.order_by(Claim.created_at.desc())).all()

@router.patch("/{claim_id}")
def update_claim(claim_id: int, payload: ClaimUpdate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    cl = session.get(Claim, claim_id)
    if not cl:
        raise HTTPException(status_code=404, detail="Claim not found")
    try:
        require_org_role(session, user, cl.organization_id, "editor")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Claim not found")

    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] is not None:
        if data["status"] not in _ALLOWED_STATUS:
            raise HTTPException(status_code=400, detail="Invalid status")
        cl.status = data["status"]

    for k in ("payout_type", "payout_amount", "notes"):
        if k in data:
            setattr(cl, k, data[k])

    session.add(cl)
    session.commit()
    session.refresh(cl)
    return cl

@router.post("/{claim_id}/archive")
def archive_claim(claim_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    cl = session.get(Claim, claim_id)
    if not cl:
        raise HTTPException(status_code=404, detail="Claim not found")
    try:
        require_org_role(session, user, cl.organization_id, "editor")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Claim not found")
    if cl.archived_at is None:
        cl.archived_at = datetime.utcnow()
        session.add(cl); session.commit()
    return {"ok": True}

@router.post("/{claim_id}/restore")
def restore_claim(claim_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    cl = session.get(Claim, claim_id)
    if not cl:
        raise HTTPException(status_code=404, detail="Claim not found")
    try:
        require_org_role(session, user, cl.organization_id, "editor")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Claim not found")
    if cl.archived_at is not None:
        cl.archived_at = None
        session.add(cl); session.commit()
    return {"ok": True}

# Backward compatible endpoint used by older frontends
@router.post("/{claim_id}/decide")
def decide_claim(claim_id: int, payload: ClaimDecision, session: Session = Depends(get_session), user=Depends(get_current_user)):
    cl = session.get(Claim, claim_id)
    if not cl:
        raise HTTPException(status_code=404, detail="Claim not found")
    try:
        require_org_role(session, user, cl.organization_id, "editor")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Claim not found")
    if payload.status not in ("approved", "denied"):
        raise HTTPException(status_code=400, detail="Invalid status")
    cl.status = payload.status
    cl.payout_type = payload.payout_type
    cl.payout_amount = payload.payout_amount
    cl.notes = payload.notes
    session.add(cl); session.commit(); session.refresh(cl)
    return cl