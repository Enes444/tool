from passlib.context import CryptContext
import os
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

JWT_SECRET = os.environ.get("SPONSOR_OPS_JWT_SECRET")
if not JWT_SECRET or JWT_SECRET.strip() == "":
    raise RuntimeError("SPONSOR_OPS_JWT_SECRET is required (set a strong secret in your environment).")
if len(JWT_SECRET) < 32:
    raise RuntimeError("SPONSOR_OPS_JWT_SECRET must be at least 32 characters.")
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = int(os.environ.get("SPONSOR_OPS_JWT_EXPIRE_MIN", "720"))  # 12h

def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)

def verify_password(pw: str, hashed: str) -> bool:
    return pwd_context.verify(pw, hashed)

def create_token(user_id: int, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRE_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")