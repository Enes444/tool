import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..db import get_session
from ..deps import get_current_user, require_org_role
from ..models import Organization, OrganizationMember, User
from ..schemas import OrganizationCreate, OrganizationUpdate, MemberInvite
from ..services import ensure_org_membership, log_activity
from ..security import hash_password

router = APIRouter(prefix="/api/orgs", tags=["orgs"])

@router.get("/")
def list_orgs(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    if user.role == "superadmin":
        return session.exec(select(Organization)).all()
    org_ids = [m.organization_id for m in session.exec(select(OrganizationMember).where(OrganizationMember.user_id==user.id)).all()]
    if not org_ids: return []
    return session.exec(select(Organization).where(Organization.id.in_(org_ids))).all()

@router.post("/")
def create_org(payload: OrganizationCreate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    org = Organization(name=payload.name)
    session.add(org); session.commit(); session.refresh(org)
    ensure_org_membership(session, org.id, user.id, role="org_admin")
    log_activity(session, org.id, "org", "created", f"Organization created: {org.name}", actor=user.email, entity_id=org.id)
    return org



@router.patch("/{org_id}")
def update_org(org_id: int, payload: OrganizationUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    require_org_role(session, user, org_id, min_role="org_admin")
    org.name = payload.name.strip()
    session.add(org); session.commit(); session.refresh(org)
    log_activity(session, org.id, "org", "updated", f"Organization renamed: {org.name}", actor=user.email, entity_id=org.id)
    return org