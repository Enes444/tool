from fastapi import FastAPI
import sentry_sdk
from .logging_config import configure_logging
import os
from fastapi.middleware.cors import CORSMiddleware
from .ratelimit import SimpleRateLimitMiddleware
from sqlmodel import Session
from .db import init_db, engine
from .routers import auth, orgs, sponsors, deals, deliverables, portal, tickets, claims, reports, activity, notifications, export, uploads

configure_logging()
if os.environ.get("SENTRY_DSN"):
    sentry_sdk.init(dsn=os.environ.get("SENTRY_DSN"), traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE","0.1")))

app = FastAPI(title="Sponsor Ops Pro API", version="0.5.0")

def _parse_cors_origins() -> list[str]:
    raw = os.environ.get("SPONSOR_OPS_CORS_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    # Dev default
    return ["http://localhost:5173","http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Basic in-memory rate limiting (good enough for pilot; configure via env)
app.add_middleware(SimpleRateLimitMiddleware)

@app.on_event("startup")
def _startup():
    init_db()
app.include_router(auth.router)
app.include_router(orgs.router)
app.include_router(sponsors.router)
app.include_router(deals.router)
app.include_router(deliverables.router)
app.include_router(portal.router)
app.include_router(tickets.router)
app.include_router(claims.router)
app.include_router(reports.router)
app.include_router(activity.router)
app.include_router(notifications.router)
app.include_router(export.router)
app.include_router(uploads.router)

@app.get("/healthz")
def health():
    return {"ok": True}