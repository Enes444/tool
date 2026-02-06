from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..db import get_session
from ..deps import get_current_user, get_current_org_id, require_org_role
from ..models import Notification
from ..schemas import MarkRead
from ..services import sync_notifications_for_org

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("/")
def list_notifications(org_id: int | None=None, limit: int=200, session: Session = Depends(get_session),
                       user=Depends(get_current_user), org_ctx: int = Depends(get_current_org_id)):
    if org_id is not None and org_id != org_ctx: raise HTTPException(status_code=404, detail="Not found")
    org_id = org_ctx
    require_org_role(session, user, org_id, "viewer")
    stmt = select(Notification).where(Notification.organization_id==org_id, Notification.user_id==user.id).order_by(Notification.created_at.desc()).limit(max(1, min(limit, 500)))
    return session.exec(stmt).all()

@router.post("/sync")
def sync_notifications(org_id: int | None=None, session: Session = Depends(get_session),
                       user=Depends(get_current_user), org_ctx: int = Depends(get_current_org_id)):
    if org_id is not None and org_id != org_ctx: raise HTTPException(status_code=404, detail="Not found")
    org_id = org_ctx
    require_org_role(session, user, org_id, "viewer")
    return sync_notifications_for_org(session, org_id, user.id)

@router.post("/mark-read")
def mark_read(payload: MarkRead, org_id: int | None=None, session: Session = Depends(get_session),
              user=Depends(get_current_user), org_ctx: int = Depends(get_current_org_id)):
    if org_id is not None and org_id != org_ctx: raise HTTPException(status_code=404, detail="Not found")
    org_id = org_ctx
    require_org_role(session, user, org_id, "viewer")
    ids = list({int(i) for i in payload.ids})
    if not ids: return {"ok": True, "updated": 0}
    notes = session.exec(select(Notification).where(Notification.organization_id==org_id, Notification.user_id==user.id, Notification.id.in_(ids))).all()
    for n in notes:
        n.is_read = True
        session.add(n)
    session.commit()
    return {"ok": True, "updated": len(notes)}