"""
Create initial admin and first customer demo data.
Run inside container:
python -m app.bootstrap_first_customer

Environment variables:
- SPONSOR_OPS_BOOTSTRAP_EMAIL (required)
- SPONSOR_OPS_BOOTSTRAP_PASSWORD (required)
- SPONSOR_OPS_FIRST_CUSTOMER_ORG (default: First Customer GmbH)
- SPONSOR_OPS_FIRST_CUSTOMER_SPONSOR (default: ACME Sponsor)
- SPONSOR_OPS_FIRST_CUSTOMER_DEAL (default: Launch Deal)
"""
from datetime import date, timedelta
import os
from sqlmodel import Session, select
from .db import init_db, engine
from .models import Organization, User, Sponsor, Deal, Deliverable
from .services import ensure_admin, ensure_org_membership


def main():
    init_db()
    email = os.environ.get('SPONSOR_OPS_BOOTSTRAP_EMAIL','').strip()
    password = os.environ.get('SPONSOR_OPS_BOOTSTRAP_PASSWORD','').strip()
    if not email or not password:
        raise SystemExit('Missing SPONSOR_OPS_BOOTSTRAP_EMAIL or SPONSOR_OPS_BOOTSTRAP_PASSWORD')

    org_name = os.environ.get('SPONSOR_OPS_FIRST_CUSTOMER_ORG','First Customer GmbH').strip()
    sponsor_name = os.environ.get('SPONSOR_OPS_FIRST_CUSTOMER_SPONSOR','ACME Sponsor').strip()
    deal_name = os.environ.get('SPONSOR_OPS_FIRST_CUSTOMER_DEAL','Launch Deal').strip()

    with Session(engine) as session:
        admin = ensure_admin(session, email=email, password=password)

        org = session.exec(select(Organization).where(Organization.name == org_name)).first()
        if not org:
            org = Organization(name=org_name)
            session.add(org)
            session.commit()
            session.refresh(org)

        ensure_org_membership(session, org.id, admin.id, role='org_admin')

        sponsor = session.exec(select(Sponsor).where(Sponsor.organization_id==org.id, Sponsor.name==sponsor_name)).first()
        if not sponsor:
            sponsor = Sponsor(organization_id=org.id, name=sponsor_name)
            session.add(sponsor)
            session.commit()
            session.refresh(sponsor)

        deal = session.exec(select(Deal).where(Deal.sponsor_id==sponsor.id, Deal.name==deal_name)).first()
        if not deal:
            today = date.today()
            deal = Deal(
                organization_id=org.id,
                sponsor_id=sponsor.id,
                name=deal_name,
                start_date=today,
                end_date=today + timedelta(days=90),
                total_value=10000,
                status='active'
            )
            session.add(deal)
            session.commit()
            session.refresh(deal)

        d = session.exec(select(Deliverable).where(Deliverable.deal_id==deal.id, Deliverable.title=='Kickoff Post')).first()
        if not d:
            d = Deliverable(deal_id=deal.id, title='Kickoff Post', type='post', due_date=date.today()+timedelta(days=7), status='draft')
            session.add(d)
            session.commit()

    print(f'Admin ready: {email}')
    print(f'Customer org ready: {org_name}')
    print(f'Sponsor/deal ready: {sponsor_name} / {deal_name}')


if __name__ == '__main__':
    main()
