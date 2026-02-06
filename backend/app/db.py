from sqlmodel import SQLModel, create_engine, Session
import os
from pathlib import Path

DB_PATH = os.environ.get("SPONSOR_OPS_DB", "sponsor_ops.db")
DATABASE_URL = os.environ.get("SPONSOR_OPS_DATABASE_URL", f"sqlite:///{DB_PATH}")

connect_args = {}
if DATABASE_URL.startswith("sqlite:"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args, pool_pre_ping=True)

def init_db():
    """
    Pilot-friendly initialization:
      - Creates tables if they don't exist (via SQLModel metadata).
      - Dev-only DB reset is disabled unless explicitly enabled.
    """
    env = os.environ.get("SPONSOR_OPS_ENV", "dev").strip().lower()
    allow_reset = os.environ.get("SPONSOR_OPS_ALLOW_RESET_DB", "").strip() == "1"

    if env == "dev" and allow_reset and os.environ.get("RESET_DB", "").strip() == "1" and DATABASE_URL.startswith("sqlite:"):
        try:
            Path(DB_PATH).unlink(missing_ok=True)
        except Exception:
            pass

    enable_create_all = os.environ.get("SPONSOR_OPS_ENABLE_CREATE_ALL", "1").strip() == "1"
    if enable_create_all:
        SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session