import os
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from ..db import get_session
from ..models import Proof, Deliverable, Deal
from ..deps import org_id_for_deal, require_org_role, get_current_user

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_ROOT = Path(os.environ.get("SPONSOR_OPS_UPLOAD_ROOT","uploads")).resolve()

def _validate_deal_token(session: Session, deal_token: str) -> Deal:
    d = session.exec(select(Deal).where(Deal.portal_token==deal_token)).first()
    if not d or d.portal_token_revoked:
        raise HTTPException(status_code=404, detail="Deal not found")
    if d.portal_token_expires_at and d.portal_token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Deal not found")
    return d

@router.get("/proof/{proof_id}")
def download_proof_file(
    proof_id: int,
    request: Request,
    deal_token: str | None = None,
    session: Session = Depends(get_session),
):
    p = session.get(Proof, proof_id)
    if not p or p.kind != "file" or not p.file_path:
        raise HTTPException(status_code=404, detail="Proof not found")

    d = session.get(Deliverable, p.deliverable_id)
    if not d: raise HTTPException(status_code=404, detail="Proof not found")
    deal = session.get(Deal, d.deal_id)
    if not deal: raise HTTPException(status_code=404, detail="Proof not found")

    auth = (request.headers.get("authorization") or "").strip()
    if auth.startswith("Bearer "):
        user = get_current_user(authorization=auth, session=session)
        org_id = org_id_for_deal(session, deal.id)
        try:
            require_org_role(session, user, org_id, "viewer")
        except HTTPException:
            raise HTTPException(status_code=404, detail="Proof not found")
    else:
        if not deal_token:
            raise HTTPException(status_code=401, detail="Missing deal_token")
        dt = _validate_deal_token(session, deal_token)
        if dt.id != deal.id:
            raise HTTPException(status_code=404, detail="Proof not found")

    abs_path = (UPLOAD_ROOT / Path(p.file_path)).resolve()
    if not str(abs_path).startswith(str(UPLOAD_ROOT)) or not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Proof not found")

    return FileResponse(path=str(abs_path), media_type=p.mime_type or "application/octet-stream", filename=p.file_name or "proof")