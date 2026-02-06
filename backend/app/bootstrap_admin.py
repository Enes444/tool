"""
One-time admin bootstrap for pilot deployments.

Usage (inside backend container):
  SPONSOR_OPS_BOOTSTRAP_EMAIL=you@company.com \
  SPONSOR_OPS_BOOTSTRAP_PASSWORD='strong password' \
  python -m app.bootstrap_admin
"""
import os
from sqlmodel import Session

from .db import init_db, engine
from .services import ensure_admin

def main():
    init_db()
    email = os.environ.get("SPONSOR_OPS_BOOTSTRAP_EMAIL", "").strip()
    password = os.environ.get("SPONSOR_OPS_BOOTSTRAP_PASSWORD", "").strip()
    if not email or not password:
        raise SystemExit("Missing SPONSOR_OPS_BOOTSTRAP_EMAIL or SPONSOR_OPS_BOOTSTRAP_PASSWORD")

    with Session(engine) as session:
        ensure_admin(session, email=email, password=password)
    print(f"Bootstrapped admin user: {email}")

if __name__ == "__main__":
    main()