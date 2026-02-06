from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..db import get_session
from ..deps import get_current_user, get_current_org_id, require_org_role
from ..models import Ticket, TicketMessage, Sponsor
from ..schemas import TicketReply, TicketUpdate

router = APIRouter(prefix="/api/tickets", tags=["tickets"])

_ALLOWED_STATUS = {"open", "pending", "closed"}
_ALLOWED_PRIORITY = {"low", "normal", "high", "urgent"}

@router.get("/")
def list_tickets(
    org_id: int | None = None,
    include_archived: bool = Query(False),
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
    org_ctx: int = Depends(get_current_org_id),
):
    # Keep legacy org_id query param (frontend sends it)
    if org_id is not None and org_id != org_ctx:
        raise HTTPException(status_code=404, detail="Not found")
    org_id = org_ctx
    require_org_role(session, user, org_id, "viewer")
    q = select(Ticket).where(Ticket.organization_id == org_id)
    if not include_archived:
        q = q.where(Ticket.archived_at.is_(None))
    return session.exec(q.order_by(Ticket.created_at.desc())).all()

@router.get("/{ticket_id}")
def get_ticket(ticket_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    t = session.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    try:
        require_org_role(session, user, t.organization_id, "viewer")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Ticket not found")

    sponsor = session.get(Sponsor, t.sponsor_id)
    if not sponsor or sponsor.organization_id != t.organization_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    msgs = session.exec(
        select(TicketMessage)
        .where(TicketMessage.ticket_id == ticket_id)
        .order_by(TicketMessage.created_at.asc())
    ).all()
    return {"ticket": t, "messages": msgs}

@router.patch("/{ticket_id}")
def update_ticket(ticket_id: int, payload: TicketUpdate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    t = session.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    try:
        require_org_role(session, user, t.organization_id, "editor")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Ticket not found")

    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] is not None:
        if data["status"] not in _ALLOWED_STATUS:
            raise HTTPException(status_code=400, detail="Invalid status")
        t.status = data["status"]

    if "priority" in data and data["priority"] is not None:
        if data["priority"] not in _ALLOWED_PRIORITY:
            raise HTTPException(status_code=400, detail="Invalid priority")
        t.priority = data["priority"]

    if "subject" in data and data["subject"] is not None:
        t.subject = data["subject"].strip()

    if "body" in data and data["body"] is not None:
        t.body = data["body"].strip()

    session.add(t)
    session.commit()
    session.refresh(t)
    return t

@router.post("/{ticket_id}/archive")
def archive_ticket(ticket_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    t = session.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    try:
        require_org_role(session, user, t.organization_id, "editor")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if t.archived_at is None:
        t.archived_at = datetime.utcnow()
        session.add(t)
        session.commit()
    return {"ok": True}

@router.post("/{ticket_id}/restore")
def restore_ticket(ticket_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    t = session.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    try:
        require_org_role(session, user, t.organization_id, "editor")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if t.archived_at is not None:
        t.archived_at = None
        session.add(t)
        session.commit()
    return {"ok": True}

@router.post("/{ticket_id}/reply")
def reply(ticket_id: int, payload: TicketReply, session: Session = Depends(get_session), user=Depends(get_current_user)):
    t = session.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    try:
        require_org_role(session, user, t.organization_id, "editor")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Ticket not found")

    sponsor = session.get(Sponsor, t.sponsor_id)
    if not sponsor or sponsor.organization_id != t.organization_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    session.add(TicketMessage(ticket_id=ticket_id, sender="admin", message=payload.message))
    t.last_reply_at = datetime.utcnow()
    session.add(t)
    session.commit()
    return {"ok": True}