from fastapi import APIRouter, Depends, Response, HTTPException
from sqlmodel import Session
from ..db import get_session
from ..deps import get_current_user, require_org_role, org_id_for_deal
from ..reporting import generate_deal_report

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/deal/{deal_id}.pdf")
def deal_pdf(deal_id: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    try:
        org_id = org_id_for_deal(session, deal_id)
        require_org_role(session, user, org_id, "viewer")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Deal not found")
    pdf = generate_deal_report(session, deal_id)
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=deal_{deal_id}.pdf"})