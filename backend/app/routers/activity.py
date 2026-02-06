from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..db import get_session
from ..deps import get_current_user, get_current_org_id, require_org_role
from ..models import Activity

router = APIRouter(prefix="/api/activity", tags=["activity"])

@router.get("/")
def list_activity(org_id: int | None = None, deal_id: int | None = None, limit: int=100,
                  session: Session = Depends(get_session),
                  user=Depends(get_current_user),
                  org_ctx: int = Depends(get_current_org_id)):
    if org_id is not None and org_id != org_ctx:
        raise HTTPException(status_code=404, detail="Not found")
    org_id = org_ctx
    require_org_role(session, user, org_id, "viewer")
    stmt = select(Activity).where(Activity.organization_id==org_id)
    if deal_id is not None: stmt = stmt.where(Activity.deal_id==deal_id)
    stmt = stmt.order_by(Activity.created_at.desc()).limit(max(1, min(limit, 500)))
    return session.exec(stmt).all()