from fastapi import Depends, Header, HTTPException, status
from sqlmodel import Session, select
from .db import get_session
from .security import decode_token
from .models import User, OrganizationMember, Sponsor, Deal

ROLE_RANK = {"viewer":10,"editor":20,"manager":30,"org_admin":40}

def get_current_user(authorization: str = Header(default=""), session: Session = Depends(get_session)) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ",1)[1].strip()
    payload = decode_token(token)
    user_id = int(payload["sub"])
    user = session.exec(select(User).where(User.id==user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_org_role(session: Session, user: User, org_id: int, min_role: str="viewer") -> OrganizationMember:
    if user.role == "superadmin":
        m = session.exec(select(OrganizationMember).where(OrganizationMember.organization_id==org_id, OrganizationMember.user_id==user.id)).first()
        if m: return m
        m = OrganizationMember(organization_id=org_id, user_id=user.id, role="org_admin")
        session.add(m); session.commit(); session.refresh(m); return m
    m = session.exec(select(OrganizationMember).where(OrganizationMember.organization_id==org_id, OrganizationMember.user_id==user.id)).first()
    if not m: raise HTTPException(status_code=403, detail="No access to this organization")
    if ROLE_RANK.get(m.role,0) < ROLE_RANK.get(min_role,0):
        raise HTTPException(status_code=403, detail="Insufficient role for this action")
    return m

def get_current_org_id(
    x_org_id: str | None = Header(default=None, alias="X-Org-Id"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> int:
    if x_org_id is not None and str(x_org_id).strip()!="":
        try: org_id = int(x_org_id)
        except Exception: raise HTTPException(status_code=400, detail="Invalid X-Org-Id")
        require_org_role(session, user, org_id, min_role="viewer"); return org_id
    m = session.exec(select(OrganizationMember).where(OrganizationMember.user_id==user.id).order_by(OrganizationMember.organization_id.asc())).first()
    if not m: raise HTTPException(status_code=403, detail="User has no organization")
    return m.organization_id

def org_id_for_deal(session: Session, deal_id: int) -> int:
    d = session.get(Deal, deal_id)
    if not d: raise HTTPException(status_code=404, detail="Deal not found")
    return d.organization_id