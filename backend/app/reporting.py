from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from io import BytesIO
from sqlmodel import Session, select
from .models import Deal, Deliverable, Proof, Claim

def generate_deal_report(session: Session, deal_id: int) -> bytes:
    deal = session.get(Deal, deal_id)
    if not deal: raise ValueError("Deal not found")
    deliverables = session.exec(select(Deliverable).where(Deliverable.deal_id==deal_id)).all()
    claims = session.exec(select(Claim).where(Claim.deal_id==deal_id)).all()

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter
    y = height - 1*inch
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1*inch, y, f"Sponsor Ops Report: {deal.name}")
    y -= 0.4*inch
    c.setFont("Helvetica", 10)
    c.drawString(1*inch, y, f"Dates: {deal.start_date} - {deal.end_date}")
    y -= 0.25*inch
    c.drawString(1*inch, y, f"Guarantee cap: {deal.guarantee_cap_pct*100:.0f}% | cure {deal.cure_days} days")
    y -= 0.4*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "Deliverables")
    y -= 0.25*inch
    c.setFont("Helvetica", 9)
    for d in deliverables:
        if y < 1*inch:
            c.showPage(); y = height - 1*inch; c.setFont("Helvetica", 9)
        proofs = session.exec(select(Proof).where(Proof.deliverable_id==d.id)).all()
        c.drawString(1*inch, y, f"- [{d.status}] {d.title} ({d.type}) due {d.due_date} | proofs: {len(proofs)}")
        y -= 0.16*inch
    y -= 0.25*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y, "Claims")
    y -= 0.25*inch
    c.setFont("Helvetica", 9)
    if not claims:
        c.drawString(1*inch, y, "No claims submitted.")
    else:
        for cl in claims:
            if y < 1*inch:
                c.showPage(); y = height - 1*inch; c.setFont("Helvetica", 9)
            c.drawString(1*inch, y, f"- [{cl.status}] deliverable_id={cl.deliverable_id} reason={cl.reason} payout={cl.payout_type}:{cl.payout_amount}")
            y -= 0.16*inch
    c.showPage(); c.save()
    return buf.getvalue()