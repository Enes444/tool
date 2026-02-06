import io, json, zipfile
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from ..db import get_session
from ..deps import get_current_user, get_current_org_id, require_org_role
from ..models import Organization, OrganizationMember, User, Sponsor, Deal, Deliverable, Proof, Ticket, TicketMessage, Claim

router = APIRouter(prefix="/api/export", tags=["export"])

def _json(obj):
    if hasattr(obj, "model_dump"): return obj.model_dump()
    if hasattr(obj, "dict"): return obj.dict()
    return obj

@router.get("/org.zip")
def export_org_zip(session: Session = Depends(get_session), user=Depends(get_current_user), org_id: int = Depends(get_current_org_id)):
    require_org_role(session, user, org_id, "manager")
    org = session.get(Organization, org_id)
    if not org: raise HTTPException(status_code=404, detail="Organization not found")

    members = session.exec(select(OrganizationMember).where(OrganizationMember.organization_id==org_id)).all()
    users = session.exec(select(User).where(User.id.in_([m.user_id for m in members]))).all() if members else []
    sponsors = session.exec(select(Sponsor).where(Sponsor.organization_id==org_id)).all()
    sponsor_ids = [s.id for s in sponsors]
    deals = session.exec(select(Deal).where(Deal.sponsor_id.in_(sponsor_ids))).all() if sponsor_ids else []
    deal_ids = [d.id for d in deals]
    deliverables = session.exec(select(Deliverable).where(Deliverable.deal_id.in_(deal_ids))).all() if deal_ids else []
    deliverable_ids = [d.id for d in deliverables]
    proofs = session.exec(select(Proof).where(Proof.deliverable_id.in_(deliverable_ids))).all() if deliverable_ids else []
    tickets = session.exec(select(Ticket).where(Ticket.organization_id==org_id)).all()
    messages = session.exec(select(TicketMessage).where(TicketMessage.ticket_id.in_([t.id for t in tickets]))).all() if tickets else []
    claims = session.exec(select(Claim).where(Claim.organization_id==org_id)).all()

    payload = {
        "exported_at": datetime.utcnow().isoformat()+"Z",
        "org": _json(org),
        "memberships": [_json(m) for m in members],
        "users": [_json(u) for u in users],
        "sponsors": [_json(s) for s in sponsors],
        "deals": [_json(d) for d in deals],
        "deliverables": [_json(d) for d in deliverables],
        "proofs": [_json(p) for p in proofs],
        "tickets": [_json(t) for t in tickets],
        "ticket_messages": [_json(m) for m in messages],
        "claims": [_json(c) for c in claims],
    }

    mem = io.BytesIO()
    with zipfile.ZipFile(mem, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("org_export.json", json.dumps(payload, indent=2, default=str))
    mem.seek(0)
    return Response(content=mem.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f"attachment; filename=org_{org_id}_export.zip"})