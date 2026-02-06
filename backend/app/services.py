import secrets
from datetime import date, timedelta
from sqlmodel import Session, select
from .models import User, Organization, OrganizationMember, Sponsor, Deal, Deliverable, Activity, Notification
from .security import hash_password

def ensure_admin(session: Session, email: str, password: str):
    org = session.exec(select(Organization).order_by(Organization.id.asc())).first()
    if not org:
        org = Organization(name="Default Org")
        session.add(org); session.commit(); session.refresh(org)
    u = session.exec(select(User).where(User.email==email)).first()
    if not u:
        u = User(email=email, hashed_password=hash_password(password), role="superadmin")
        session.add(u); session.commit(); session.refresh(u)
    ensure_org_membership(session, org.id, u.id, role="org_admin")
    return u

def ensure_org_membership(session: Session, org_id: int, user_id: int, role: str="org_admin"):
    m = session.exec(select(OrganizationMember).where(OrganizationMember.organization_id==org_id, OrganizationMember.user_id==user_id)).first()
    if m: return m
    m = OrganizationMember(organization_id=org_id, user_id=user_id, role=role)
    session.add(m); session.commit(); session.refresh(m); return m

def log_activity(session: Session, organization_id: int, entity_type: str, action: str, summary: str,
                 actor: str | None=None, deal_id: int | None=None, entity_id: int | None=None):
    a = Activity(organization_id=organization_id, deal_id=deal_id, entity_type=entity_type,
                 entity_id=entity_id, action=action, summary=summary, actor=actor)
    session.add(a); session.commit(); session.refresh(a); return a

def sync_notifications_for_org(session: Session, organization_id: int, user_id: int, days_due_soon: int=3):
    today = date.today()
    due_soon_until = today + timedelta(days=days_due_soon)
    existing = session.exec(select(Notification).where(Notification.organization_id==organization_id, Notification.user_id==user_id, Notification.is_read==False)).all()
    existing_keys = set((n.kind,n.title) for n in existing)

    sponsor_ids = [s.id for s in session.exec(select(Sponsor).where(Sponsor.organization_id==organization_id)).all()]
    deal_ids = [d.id for d in session.exec(select(Deal).where(Deal.sponsor_id.in_(sponsor_ids))).all()] if sponsor_ids else []
    created = 0
    if deal_ids:
        dels = session.exec(select(Deliverable).where(Deliverable.deal_id.in_(deal_ids))).all()
        for d in dels:
            if d.status in ("delivered","canceled"): continue
            if d.due_date < today:
                title = f"Overdue: {d.title}"
                if ("overdue",title) not in existing_keys:
                    session.add(Notification(organization_id=organization_id,user_id=user_id,kind="overdue",title=title,body=f"Deliverable #{d.id} overdue (due {d.due_date}).",link=f"/deals/{d.deal_id}"))
                    created += 1
            elif today <= d.due_date <= due_soon_until:
                title = f"Due soon: {d.title}"
                if ("due_soon",title) not in existing_keys:
                    session.add(Notification(organization_id=organization_id,user_id=user_id,kind="due_soon",title=title,body=f"Deliverable #{d.id} due {d.due_date}.",link=f"/deals/{d.deal_id}"))
                    created += 1
        session.commit()
    return {"created": created}