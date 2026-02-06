from __future__ import annotations

from datetime import datetime
from pathlib import Path
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlmodel import Session, select

from ..db import get_session
from ..models import (
    Sponsor, Deal, Deliverable, Proof, Ticket, TicketMessage, Claim, DeliverableComment, BrandKit
)
from ..schemas import (
    TicketCreate, ClaimCreate,
    PortalTicketReply, PortalTicketGet, PortalDeliverableApprove, PortalDeliverableComment, PortalProofLink
)

router = APIRouter(prefix="/api/portal", tags=["portal"])

UPLOAD_ROOT = Path(os.environ.get("SPONSOR_OPS_UPLOAD_ROOT", "uploads"))
MAX_UPLOAD_MB = int(os.environ.get("SPONSOR_OPS_MAX_UPLOAD_MB", "50"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
ALLOWED_MIME = {"image/png", "image/jpeg", "application/pdf", "video/mp4"}


def _safe_original_name(name: str) -> str:
    # drop any path components and normalize weird chars
    name = (name or "proof").replace("\\", "/").split("/")[-1]
    name = "".join(ch for ch in name if ch.isalnum() or ch in ("-", "_", ".", " ", "(", ")", "[", "]"))
    name = name.strip().replace(" ", "_")
    return name[:140] or "proof"


def _get_sponsor_by_token(session: Session, sponsor_token: str) -> Sponsor:
    sponsor = session.exec(select(Sponsor).where(Sponsor.portal_token == sponsor_token)).first()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    if sponsor.portal_token_revoked:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    if sponsor.portal_token_expires_at and sponsor.portal_token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Sponsor not found")
    return sponsor


def _get_deal_by_token(session: Session, deal_token: str) -> Deal:
    deal = session.exec(select(Deal).where(Deal.portal_token == deal_token)).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.portal_token_revoked:
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.portal_token_expires_at and deal.portal_token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


def _ensure_ticket_access_by_sponsor_token(session: Session, sponsor: Sponsor, ticket: Ticket, deal_token: str | None = None):
    if ticket.sponsor_id != sponsor.id or ticket.organization_id != sponsor.organization_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.deal_id is not None and deal_token:
        deal = _get_deal_by_token(session, deal_token)
        if deal.id != ticket.deal_id:
            raise HTTPException(status_code=404, detail="Ticket not found")
    # if ticket is tied to a deal but deal_token not provided, still allow sponsor-level access
    return True


@router.get("/sponsor/{token}")
def sponsor_portal(token: str, session: Session = Depends(get_session)):
    sponsor = _get_sponsor_by_token(session, token)
    deals = session.exec(select(Deal).where(Deal.sponsor_id == sponsor.id)).all()
    return {"sponsor": sponsor, "deals": deals}


@router.get("/deal/{token}")
def deal_portal(token: str, session: Session = Depends(get_session)):
    """Deal portal view (no login). Returns all deal-relevant objects including messages and comments."""
    deal = _get_deal_by_token(session, token)

    deliverables = session.exec(select(Deliverable).where(Deliverable.deal_id == deal.id)).all()

    proofs = session.exec(
        select(Proof)
        .join(Deliverable, Proof.deliverable_id == Deliverable.id)
        .where(Deliverable.deal_id == deal.id)
    ).all()

    comments = session.exec(
        select(DeliverableComment)
        .join(Deliverable, DeliverableComment.deliverable_id == Deliverable.id)
        .where(Deliverable.deal_id == deal.id)
        .order_by(DeliverableComment.created_at.asc())
    ).all()

    claims = session.exec(select(Claim).where(Claim.deal_id == deal.id)).all()

    tickets = session.exec(select(Ticket).where(Ticket.deal_id == deal.id).order_by(Ticket.created_at.desc())).all()
    ticket_ids = [t.id for t in tickets]
    ticket_messages = session.exec(
        select(TicketMessage).where(TicketMessage.ticket_id.in_(ticket_ids)).order_by(TicketMessage.created_at.asc())
    ).all() if ticket_ids else []

    bk = session.exec(select(BrandKit).where(BrandKit.deal_id == deal.id)).first()

    return {
        "deal": deal,
        "deliverables": deliverables,
        "proofs": proofs,
        "comments": comments,
        "brandkit": bk,
        "claims": claims,
        "tickets": tickets,
        "ticket_messages": ticket_messages,
    }


@router.post("/ticket")
def create_ticket(payload: TicketCreate, session: Session = Depends(get_session)):
    sponsor = _get_sponsor_by_token(session, payload.sponsor_token)

    deal_id = None
    if payload.deal_token:
        deal = _get_deal_by_token(session, payload.deal_token)
        # sponsor must own deal
        if deal.sponsor_id != sponsor.id:
            raise HTTPException(status_code=404, detail="Deal not found")
        deal_id = deal.id

    t = Ticket(
        organization_id=sponsor.organization_id,
        sponsor_id=sponsor.id,
        deal_id=deal_id,
        subject=payload.subject,
        body=payload.body,
        status="open",
        last_reply_at=None,
    )
    session.add(t)
    session.commit()
    session.refresh(t)

    msg = TicketMessage(ticket_id=t.id, sender="sponsor", message=payload.body)
    session.add(msg)
    t.last_reply_at = datetime.utcnow()
    session.add(t)
    session.commit()
    session.refresh(t)
    return t


@router.get("/ticket/{ticket_id}")
def get_ticket(ticket_id: int, sponsor_token: str, deal_token: str | None = None, session: Session = Depends(get_session)):
    sponsor = _get_sponsor_by_token(session, sponsor_token)
    t = session.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    _ensure_ticket_access_by_sponsor_token(session, sponsor, t, deal_token=deal_token)
    msgs = session.exec(select(TicketMessage).where(TicketMessage.ticket_id == ticket_id).order_by(TicketMessage.created_at.asc())).all()
    return {"ticket": t, "messages": msgs}


@router.post("/ticket/{ticket_id}/reply")
def reply_ticket(ticket_id: int, payload: PortalTicketReply, session: Session = Depends(get_session)):
    sponsor = _get_sponsor_by_token(session, payload.sponsor_token)
    t = session.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    _ensure_ticket_access_by_sponsor_token(session, sponsor, t, deal_token=payload.deal_token)

    msg = TicketMessage(ticket_id=ticket_id, sender="sponsor", message=payload.message)
    session.add(msg)

    # status hint: if it was waiting on sponsor, move back to team
    if t.status == "waiting_on_sponsor":
        t.status = "waiting_on_team"
    t.last_reply_at = datetime.utcnow()
    session.add(t)
    session.commit()
    return {"ok": True}


@router.post("/claim")
def create_claim(payload: ClaimCreate, session: Session = Depends(get_session)):
    deal = _get_deal_by_token(session, payload.deal_token)

    d = session.get(Deliverable, payload.deliverable_id)
    if not d or d.deal_id != deal.id:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    if not d.guaranteed:
        raise HTTPException(status_code=400, detail="Deliverable is not guaranteed")

    sponsor = session.get(Sponsor, deal.sponsor_id)
    if not sponsor:
        raise HTTPException(status_code=404, detail="Deal not found")

    cl = Claim(
        organization_id=sponsor.organization_id,
        deal_id=deal.id,
        deliverable_id=d.id,
        reason=payload.reason,
        description=payload.description,
    )
    session.add(cl)
    session.commit()
    session.refresh(cl)
    return cl


@router.post("/deliverables/{deliverable_id}/approve")
def sponsor_approve_deliverable(deliverable_id: int, payload: PortalDeliverableApprove, session: Session = Depends(get_session)):
    deal = _get_deal_by_token(session, payload.deal_token)
    d = session.get(Deliverable, deliverable_id)
    if not d or d.deal_id != deal.id:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    d.sponsor_approved_at = datetime.utcnow()
    d.sponsor_approved_by = payload.approved_by or "sponsor"
    if d.status in ("draft", "in_progress", "submitted", "needs_changes", "sponsor_review", "internal_review"):
        d.status = "approved"
    session.add(d)
    session.commit()
    session.refresh(d)
    return d


@router.get("/deliverables/{deliverable_id}/comments")
def list_deliverable_comments(deliverable_id: int, deal_token: str, session: Session = Depends(get_session)):
    deal = _get_deal_by_token(session, deal_token)
    d = session.get(Deliverable, deliverable_id)
    if not d or d.deal_id != deal.id:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    return session.exec(
        select(DeliverableComment)
        .where(DeliverableComment.deliverable_id == deliverable_id)
        .order_by(DeliverableComment.created_at.asc())
    ).all()


@router.post("/deliverables/{deliverable_id}/comments")
def add_deliverable_comment(deliverable_id: int, payload: PortalDeliverableComment, session: Session = Depends(get_session)):
    deal = _get_deal_by_token(session, payload.deal_token)
    d = session.get(Deliverable, deliverable_id)
    if not d or d.deal_id != deal.id:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    c = DeliverableComment(
        deliverable_id=deliverable_id,
        author=payload.author or "sponsor",
        body=payload.body,
    )
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


@router.post("/deliverables/{deliverable_id}/proofs")
def add_proof_link_portal(deliverable_id: int, payload: PortalProofLink, session: Session = Depends(get_session)):
    deal = _get_deal_by_token(session, payload.deal_token)
    d = session.get(Deliverable, deliverable_id)
    if not d or d.deal_id != deal.id:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    p = Proof(deliverable_id=deliverable_id, kind="link", url=payload.url, note=payload.note)
    session.add(p)
    session.commit()
    session.refresh(p)
    # status progression
    if d.status in ("posted", "proofed"):
        d.status = "proofed"
        session.add(d)
        session.commit()
    return p


@router.post("/deliverables/{deliverable_id}/proofs/upload")
async def upload_proof_file_portal(
    deliverable_id: int,
    request: Request,
    file: UploadFile = File(...),
    note: str = Form(""),
    deal_token: str = Form(...),
    session: Session = Depends(get_session),
):
    deal = _get_deal_by_token(session, deal_token)
    d = session.get(Deliverable, deliverable_id)
    if not d or d.deal_id != deal.id:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    # size guard (best-effort; depends on server/proxy)
    cl = request.headers.get("content-length")
    if cl:
        try:
            if int(cl) > MAX_UPLOAD_BYTES + 1024 * 1024:
                raise HTTPException(status_code=413, detail=f"Upload too large (max {MAX_UPLOAD_MB}MB)")
        except ValueError:
            pass

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    subdir = UPLOAD_ROOT / str(deliverable_id)
    subdir.mkdir(parents=True, exist_ok=True)

    orig = _safe_original_name(file.filename or "proof")
    ext = Path(orig).suffix.lower()
    ct = (file.content_type or "").lower().strip()
    if ct not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_MIME))}")
    if ext in ("", ".", ".."):
        ext = ""
    if ext and ext not in (".png", ".jpg", ".jpeg", ".pdf", ".mp4"):
        raise HTTPException(status_code=400, detail="Unsupported file extension")

    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    dest = subdir / f"{ts}_{orig}"

    # stream read with hard cap
    total = 0
    with dest.open("wb") as f:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                try:
                    dest.unlink(missing_ok=True)
                except Exception:
                    pass
                raise HTTPException(status_code=413, detail=f"Upload too large (max {MAX_UPLOAD_MB}MB)")
            f.write(chunk)

    rel = str(dest.as_posix())
    p = Proof(
        deliverable_id=deliverable_id,
        kind="file",
        note=note or None,
        file_path=rel,
        file_name=orig,
        mime_type=ct,
    )
    session.add(p)
    session.commit()
    session.refresh(p)

    if d.status in ("posted", "proofed"):
        d.status = "proofed"
        session.add(d)
        session.commit()

    return p