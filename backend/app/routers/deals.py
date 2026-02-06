import json, os, re, secrets
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlmodel import Session, select

from ..db import get_session
from ..deps import get_current_user, require_org_role, org_id_for_deal
from ..models import Deal, Sponsor, Deliverable, Proof, Claim, BrandKit, DeliverableComment, User
from ..schemas import (
    DealCreate,
    DealUpdate,
    DealRead,
    DeliverableCreate,
    DeliverableUpdate,
    DeliverableRead,
    ProofCreate,
    BrandKitUpdate,
    CommentCreate,
    ApplyTemplate,
)
from ..services import log_activity

router = APIRouter(prefix="/api/deals", tags=["deals"])

UPLOAD_ROOT = Path(os.environ.get("SPONSOR_OPS_UPLOAD_ROOT","uploads"))
MAX_UPLOAD_MB = int(os.environ.get("SPONSOR_OPS_MAX_UPLOAD_MB","50"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

ALLOWED_MIME = {"image/png","image/jpeg","application/pdf","video/mp4"}
ALLOWED_EXT = {".png",".jpg",".jpeg",".pdf",".mp4"}
_filename_strip = re.compile(r"[^a-zA-Z0-9._-]+")

def _safe_original_name(name: str) -> str:
    name = (name or "proof").strip().replace("\\","_").replace("/","_")
    name = _filename_strip.sub("_", name)
    return (name[:180] or "proof")

def _ensure_deal_access(session: Session, user, deal_id: int, min_role: str="viewer") -> int:
    org_id = org_id_for_deal(session, deal_id)
    require_org_role(session, user, org_id, min_role=min_role)
    return org_id

@router.post("/")
def create_deal(payload: DealCreate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    sponsor = session.get(Sponsor, payload.sponsor_id)
    if not sponsor: raise HTTPException(status_code=404, detail="Sponsor not found")
    require_org_role(session, user, sponsor.organization_id, min_role="editor")

    deal = Deal(
        organization_id=sponsor.organization_id,
        sponsor_id=payload.sponsor_id,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        total_value=payload.total_value,
        # Pilot-friendly: be resilient to older/cached frontends or schemas.
        guarantee_cap_pct=float(getattr(payload, "guarantee_cap_pct", 0.0) or 0.0),
        cure_days=int(getattr(payload, "cure_days", 0) or 0),
    )
    # default expiry: end_date + 30 days
    try:
        deal.portal_token_expires_at = datetime.combine(deal.end_date, datetime.min.time()) + timedelta(days=30)
    except Exception:
        deal.portal_token_expires_at = datetime.utcnow() + timedelta(days=365)

    session.add(deal); session.commit(); session.refresh(deal)
    log_activity(session, sponsor.organization_id, "deal", "created", f"Deal created: {deal.name}", actor=user.email, deal_id=deal.id, entity_id=deal.id)
    return deal

@router.get("/{deal_id}")
def get_deal(deal_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    _ensure_deal_access(session, user, deal_id, "viewer")
    d = session.get(Deal, deal_id)
    if not d: raise HTTPException(status_code=404, detail="Deal not found")
    return d

@router.patch("/{deal_id}")
def update_deal(deal_id: int, payload: DealUpdate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    org_id = _ensure_deal_access(session, user, deal_id, "editor")
    d = session.get(Deal, deal_id)
    if not d: raise HTTPException(status_code=404, detail="Deal not found")

    data = payload.model_dump(exclude_unset=True)
    new_status = data.pop("status", None)
    for k,v in data.items(): setattr(d, k, v)

    if new_status:
        if new_status == "archived":
            require_org_role(session, user, org_id, "manager")
            d.archived_at = datetime.utcnow()
        if new_status == "completed":
            dels = session.exec(select(Deliverable).where(Deliverable.deal_id==deal_id)).all()
            if any(x.status not in ("delivered","canceled") for x in dels):
                raise HTTPException(status_code=400, detail="Cannot complete: some deliverables are not delivered/canceled")
            d.completed_at = datetime.utcnow()
        d.status = new_status

    session.add(d); session.commit(); session.refresh(d)
    log_activity(session, org_id, "deal", "updated", f"Deal updated: {d.name}", actor=user.email, deal_id=deal_id, entity_id=deal_id)
    return d


@router.delete("/{deal_id}")
def delete_deal_archive(deal_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    # Backward compatible: treat DELETE as archive (pilot-safe)
    org_id = _ensure_deal_access(session, user, deal_id, "manager")
    d = session.get(Deal, deal_id)
    if not d: raise HTTPException(status_code=404, detail="Deal not found")
    if d.archived_at is None:
        d.archived_at = datetime.utcnow()
    d.status = "archived"
    session.add(d); session.commit(); session.refresh(d)
    log_activity(session, org_id, "deal", "archived", f"Deal archived: {d.name}", actor=user.email, deal_id=deal_id, entity_id=deal_id)
    return {"ok": True}

@router.post("/{deal_id}/archive")
def archive_deal(deal_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    org_id = _ensure_deal_access(session, user, deal_id, "manager")
    d = session.get(Deal, deal_id)
    if not d: raise HTTPException(status_code=404, detail="Deal not found")
    if d.archived_at is None:
        d.archived_at = datetime.utcnow()
    d.status = "archived"
    session.add(d); session.commit(); session.refresh(d)
    log_activity(session, org_id, "deal", "archived", f"Deal archived: {d.name}", actor=user.email, deal_id=deal_id, entity_id=deal_id)
    return {"ok": True}

@router.post("/{deal_id}/unarchive")
def unarchive_deal(deal_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    org_id = _ensure_deal_access(session, user, deal_id, "manager")
    d = session.get(Deal, deal_id)
    if not d: raise HTTPException(status_code=404, detail="Deal not found")
    d.archived_at = None
    if d.status == "archived":
        d.status = "active"
    session.add(d); session.commit(); session.refresh(d)
    log_activity(session, org_id, "deal", "restored", f"Deal restored: {d.name}", actor=user.email, deal_id=deal_id, entity_id=deal_id)
    return {"ok": True}

@router.get("/{deal_id}/deliverables")
def list_deliverables(
    deal_id: int,
    include_archived: bool = False,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    _ensure_deal_access(session, user, deal_id, "viewer")
    q = select(Deliverable).where(Deliverable.deal_id == deal_id)
    if not include_archived:
        q = q.where(Deliverable.archived_at.is_(None))
    return session.exec(q.order_by(Deliverable.due_date.asc())).all()

@router.post("/{deal_id}/deliverables")
def create_deliverable(deal_id: int, payload: DeliverableCreate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    org_id = _ensure_deal_access(session, user, deal_id, "editor")
    if payload.deal_id != deal_id: raise HTTPException(status_code=400, detail="deal_id mismatch")
    d = Deliverable(
        deal_id=deal_id,
        title=payload.title,
        type=payload.type,
        due_date=payload.due_date,
        owner=payload.owner,
        assignee_user_id=payload.assignee_user_id,
        sponsor_approval_required=payload.sponsor_approval_required,
        guaranteed=payload.guaranteed,
        value=payload.value,
        brief=payload.brief,
    )
    session.add(d); session.commit(); session.refresh(d)
    log_activity(session, org_id, "deliverable", "created", f"Deliverable created: {d.title}", actor=user.email, deal_id=deal_id, entity_id=d.id)
    return d

@router.patch("/deliverables/{deliverable_id}")
def update_deliverable(deliverable_id: int, payload: DeliverableUpdate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    d = session.get(Deliverable, deliverable_id)
    if not d: raise HTTPException(status_code=404, detail="Deliverable not found")
    org_id = _ensure_deal_access(session, user, d.deal_id, "editor")

    data = payload.model_dump(exclude_unset=True)
    if data.get("status") == "delivered":
        proofs = session.exec(select(Proof).where(Proof.deliverable_id==deliverable_id)).all()
        if not proofs and not data.get("delivered_override_note"):
            raise HTTPException(status_code=400, detail="Cannot mark delivered without proof. Add proof or provide delivered_override_note.")
        d.delivered_at = datetime.utcnow()
        d.delivered_by = user.email

    for k,v in data.items(): setattr(d, k, v)
    if payload.sponsor_approved_at and d.status in ("submitted","in_progress","draft","needs_changes"):
        d.status = "approved"

    session.add(d); session.commit(); session.refresh(d)
    log_activity(session, org_id, "deliverable", "updated", f"Deliverable updated: {d.title}", actor=user.email, deal_id=d.deal_id, entity_id=d.id)
    return d


@router.post("/deliverables/{deliverable_id}/archive")
def archive_deliverable(deliverable_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    d = session.get(Deliverable, deliverable_id)
    if not d: raise HTTPException(status_code=404, detail="Deliverable not found")
    org_id = _ensure_deal_access(session, user, d.deal_id, "editor")
    if d.archived_at is None:
        d.archived_at = datetime.utcnow()
        session.add(d); session.commit(); session.refresh(d)
        log_activity(session, org_id, "deliverable", "archived", f"Deliverable archived: {d.title}", actor=user.email, deal_id=d.deal_id, entity_id=d.id)
    return {"ok": True}

@router.post("/deliverables/{deliverable_id}/restore")
def restore_deliverable(deliverable_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    d = session.get(Deliverable, deliverable_id)
    if not d: raise HTTPException(status_code=404, detail="Deliverable not found")
    org_id = _ensure_deal_access(session, user, d.deal_id, "editor")
    if d.archived_at is not None:
        d.archived_at = None
        session.add(d); session.commit(); session.refresh(d)
        log_activity(session, org_id, "deliverable", "restored", f"Deliverable restored: {d.title}", actor=user.email, deal_id=d.deal_id, entity_id=d.id)
    return {"ok": True}

@router.post("/deliverables/{deliverable_id}/cancel")
def cancel_deliverable(deliverable_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    d = session.get(Deliverable, deliverable_id)
    if not d: raise HTTPException(status_code=404, detail="Deliverable not found")
    org_id = _ensure_deal_access(session, user, d.deal_id, "editor")
    if d.canceled_at is None:
        d.canceled_at = datetime.utcnow()
        d.canceled_by = user.email
    d.status = "canceled"
    session.add(d); session.commit(); session.refresh(d)
    log_activity(session, org_id, "deliverable", "canceled", f"Deliverable canceled: {d.title}", actor=user.email, deal_id=d.deal_id, entity_id=d.id)
    return d

@router.post("/deliverables/{deliverable_id}/proofs")
def add_proof_link(deliverable_id: int, payload: ProofCreate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    d = session.get(Deliverable, deliverable_id)
    if not d: raise HTTPException(status_code=404, detail="Deliverable not found")
    org_id = _ensure_deal_access(session, user, d.deal_id, "editor")
    p = Proof(deliverable_id=deliverable_id, kind="link", url=payload.url, note=payload.note)
    session.add(p); session.commit(); session.refresh(p)
    log_activity(session, org_id, "proof", "created", f"Proof link added for deliverable: {d.title}", actor=user.email, deal_id=d.deal_id, entity_id=p.id)
    return p

@router.get("/deliverables/{deliverable_id}/proofs")
def list_proofs(deliverable_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    d = session.get(Deliverable, deliverable_id)
    if not d: raise HTTPException(status_code=404, detail="Deliverable not found")
    _ensure_deal_access(session, user, d.deal_id, "viewer")
    return session.exec(select(Proof).where(Proof.deliverable_id==deliverable_id).order_by(Proof.created_at.desc())).all()

@router.post("/deliverables/{deliverable_id}/proofs/upload")
async def upload_proof_file(
    deliverable_id: int,
    request: Request,
    file: UploadFile = File(...),
    note: str = Form(""),
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    d = session.get(Deliverable, deliverable_id)
    if not d: raise HTTPException(status_code=404, detail="Deliverable not found")
    org_id = _ensure_deal_access(session, user, d.deal_id, "editor")

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    subdir = UPLOAD_ROOT / str(deliverable_id)
    subdir.mkdir(parents=True, exist_ok=True)

    orig = _safe_original_name(file.filename or "proof")
    ext = Path(orig).suffix.lower()
    ct = (file.content_type or "").lower().strip()
    if ct not in ALLOWED_MIME: raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")
    if ext not in ALLOWED_EXT: raise HTTPException(status_code=400, detail=f"Unsupported file extension: {ext}")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_UPLOAD_MB}MB")

    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    rnd = secrets.token_urlsafe(16).replace("-","").replace("_","")
    dest = subdir / f"{ts}_{rnd}{ext}"
    dest.write_bytes(content)
    rel = str(dest.relative_to(UPLOAD_ROOT).as_posix())

    p = Proof(deliverable_id=deliverable_id, kind="file", note=note or None, file_path=rel, file_name=orig, mime_type=file.content_type)
    session.add(p); session.commit(); session.refresh(p)

    log_activity(session, org_id, "proof", "uploaded", f"Proof file uploaded for deliverable: {d.title}", actor=user.email, deal_id=d.deal_id, entity_id=p.id)
    return p

@router.get("/deliverables/{deliverable_id}/comments")
def list_comments(deliverable_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    d = session.get(Deliverable, deliverable_id)
    if not d: raise HTTPException(status_code=404, detail="Deliverable not found")
    _ensure_deal_access(session, user, d.deal_id, "viewer")
    return session.exec(select(DeliverableComment).where(DeliverableComment.deliverable_id==deliverable_id).order_by(DeliverableComment.created_at.asc())).all()

@router.post("/deliverables/{deliverable_id}/comments")
def add_comment(deliverable_id: int, payload: CommentCreate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    d = session.get(Deliverable, deliverable_id)
    if not d: raise HTTPException(status_code=404, detail="Deliverable not found")
    org_id = _ensure_deal_access(session, user, d.deal_id, "viewer")
    c = DeliverableComment(deliverable_id=deliverable_id, author=user.email, body=payload.body)
    session.add(c); session.commit(); session.refresh(c)
    log_activity(session, org_id, "deliverable", "commented", f"Comment on deliverable: {d.title}", actor=user.email, deal_id=d.deal_id, entity_id=c.id)
    return c

@router.get("/{deal_id}/brandkit")
def get_brandkit(deal_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    _ensure_deal_access(session, user, deal_id, "viewer")
    bk = session.exec(select(BrandKit).where(BrandKit.deal_id==deal_id)).first()
    if not bk:
        bk = BrandKit(deal_id=deal_id)
        session.add(bk); session.commit(); session.refresh(bk)
    return {"id": bk.id, "deal_id": bk.deal_id, "guidelines_md": bk.guidelines_md,
            "hashtags": json.loads(bk.hashtags_json or "[]"),
            "required_tags": json.loads(bk.required_tags_json or "[]"),
            "do": json.loads(bk.do_json or "[]"),
            "dont": json.loads(bk.dont_json or "[]"),
            "assets": json.loads(bk.assets_json or "[]"),
            "updated_at": bk.updated_at}

@router.put("/{deal_id}/brandkit")
def update_brandkit(deal_id: int, payload: BrandKitUpdate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    org_id = _ensure_deal_access(session, user, deal_id, "editor")
    bk = session.exec(select(BrandKit).where(BrandKit.deal_id==deal_id)).first() or BrandKit(deal_id=deal_id)
    bk.guidelines_md = payload.guidelines_md or ""
    bk.hashtags_json = json.dumps(payload.hashtags or [])
    bk.required_tags_json = json.dumps(payload.required_tags or [])
    bk.do_json = json.dumps(payload.do or [])
    bk.dont_json = json.dumps(payload.dont or [])
    bk.assets_json = json.dumps(payload.assets or [])
    bk.updated_at = datetime.utcnow()
    session.add(bk); session.commit(); session.refresh(bk)
    log_activity(session, org_id, "brandkit", "updated", "BrandKit updated", actor=user.email, deal_id=deal_id, entity_id=bk.id)
    return {"ok": True}

@router.post("/{deal_id}/apply-template")
def apply_template(deal_id: int, payload: ApplyTemplate, session: Session = Depends(get_session), user=Depends(get_current_user)):
    org_id = _ensure_deal_access(session, user, deal_id, "editor")
    deal = session.get(Deal, deal_id)
    if not deal: raise HTTPException(status_code=404, detail="Deal not found")
    if payload.template != "valorant_standard":
        raise HTTPException(status_code=400, detail="Unknown template")
    start = deal.start_date
    items = [
        ("TikTok #1", "tiktok", 3, True, 300),
        ("Creator Integration #1", "integration", 5, True, 800),
        ("Discord Announcement", "discord", 2, False, 100),
        ("Stream Mention #1", "stream", 6, False, 150),
        ("TikTok #2", "tiktok", 10, False, 300),
        ("YouTube Shorts Cutdown", "shorts", 12, False, 250),
        ("Stream Mention #2", "stream", 13, False, 150),
        ("TikTok #3", "tiktok", 17, False, 300),
        ("Creator Integration #2", "integration", 19, False, 800),
        ("Discord Event (AMA/Viewparty)", "event", 21, False, 400),
        ("TikTok #4", "tiktok", 24, False, 300),
        ("Monthly Recap Post", "recap", 28, False, 250),
    ]
    for title, typ, delta, guaranteed, val in items:
        session.add(Deliverable(deal_id=deal_id, title=title, type=typ, due_date=start+timedelta(days=delta),
                                sponsor_approval_required=(typ in ("integration","recap")), guaranteed=guaranteed, value=val))
    session.commit()
    log_activity(session, org_id, "deal", "updated", f"Applied template: {payload.template} ({len(items)} deliverables)", actor=user.email, deal_id=deal_id, entity_id=deal_id)
    return {"created": len(items)}

@router.get("/{deal_id}/claims")
def list_claims(deal_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    _ensure_deal_access(session, user, deal_id, "viewer")
    return session.exec(select(Claim).where(Claim.deal_id==deal_id)).all()

@router.post("/{deal_id}/portal/revoke")
def revoke_deal_portal(deal_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    org_id = _ensure_deal_access(session, user, deal_id, "manager")
    deal = session.get(Deal, deal_id)
    if not deal: raise HTTPException(status_code=404, detail="Deal not found")
    deal.portal_token_revoked = True
    session.add(deal); session.commit()
    log_activity(session, org_id, "deal", "updated", "Portal token revoked", actor=user.email, deal_id=deal_id, entity_id=deal_id)
    return {"ok": True}

@router.post("/{deal_id}/portal/rotate")
def rotate_deal_portal(deal_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    org_id = _ensure_deal_access(session, user, deal_id, "manager")
    deal = session.get(Deal, deal_id)
    if not deal: raise HTTPException(status_code=404, detail="Deal not found")
    deal.portal_token = secrets.token_urlsafe(16)
    deal.portal_token_revoked = False
    try:
        deal.portal_token_expires_at = datetime.combine(deal.end_date, datetime.min.time()) + timedelta(days=30)
    except Exception:
        deal.portal_token_expires_at = datetime.utcnow() + timedelta(days=365)
    session.add(deal); session.commit(); session.refresh(deal)
    log_activity(session, org_id, "deal", "updated", "Portal token rotated", actor=user.email, deal_id=deal_id, entity_id=deal_id)
    return deal



@router.delete("/deals/{deal_id}", response_model=DealRead)
def archive_deal(
    deal_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not user.org_id:
        raise HTTPException(status_code=403, detail="No org assigned")
    require_org_role(session, user, user.org_id, "manager")
    """Pilot-safe delete: archive instead of hard delete."""
    deal = session.get(Deal, deal_id)
    if not deal or deal.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.status != "archived":
        deal.status = "archived"
    if deal.archived_at is None:
        deal.archived_at = datetime.utcnow()
    # optional: revoke portal token if exists
    if deal.portal_token:
        deal.portal_token_revoked = True
    session.add(deal)
    session.commit()
    session.refresh(deal)
    return deal


@router.post("/deals/{deal_id}/unarchive", response_model=DealRead)
def unarchive_deal(
    deal_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not user.org_id:
        raise HTTPException(status_code=403, detail="No org assigned")
    require_org_role(session, user, user.org_id, "manager")
    deal = session.get(Deal, deal_id)
    if not deal or deal.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal.status = "active"
    deal.archived_at = None
    session.add(deal)
    session.commit()
    session.refresh(deal)
    return deal


@router.post("/deliverables/{deliverable_id}/cancel", response_model=DeliverableRead)
def cancel_deliverable(
    deliverable_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not user.org_id:
        raise HTTPException(status_code=403, detail="No org assigned")
    require_org_role(session, user, user.org_id, "manager")
    d = session.get(Deliverable, deliverable_id)
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    deal = session.get(Deal, d.deal_id)
    if not deal or deal.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    d.status = "canceled"
    d.canceled_at = datetime.utcnow()
    d.canceled_by = user.email
    session.add(d)
    session.commit()
    session.refresh(d)
    return d


@router.post("/deliverables/{deliverable_id}/restore", response_model=DeliverableRead)
def restore_deliverable(
    deliverable_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not user.org_id:
        raise HTTPException(status_code=403, detail="No org assigned")
    require_org_role(session, user, user.org_id, "manager")
    d = session.get(Deliverable, deliverable_id)
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    deal = session.get(Deal, d.deal_id)
    if not deal or deal.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    # restore to draft if previously canceled
    if d.status == "canceled":
        d.status = "draft"
    d.canceled_at = None
    d.canceled_by = None
    session.add(d)
    session.commit()
    session.refresh(d)
    return d