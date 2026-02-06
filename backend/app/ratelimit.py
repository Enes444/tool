from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

class SimpleRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Very small, in-memory fixed-window rate limiter.

    Intended for pilot environments only (single instance). Configure via:
      - SPONSOR_OPS_RATE_LIMIT_ENABLED (default: "1")
      - SPONSOR_OPS_RATE_LIMIT_REQUESTS_PER_MIN (default: "240")
      - SPONSOR_OPS_RATE_LIMIT_BURST (default: same as per-min)

    Keying: client IP + path prefix (portal/uploads/login)
    """
    def __init__(self, app):
        super().__init__(app)
        self.enabled = os.environ.get("SPONSOR_OPS_RATE_LIMIT_ENABLED", "1").strip() == "1"
        self.per_min = int(os.environ.get("SPONSOR_OPS_RATE_LIMIT_REQUESTS_PER_MIN", "240"))
        self.window_sec = 60
        self.burst = int(os.environ.get("SPONSOR_OPS_RATE_LIMIT_BURST", str(self.per_min)))
        self.buckets: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)

    def _bucket_key(self, request: Request) -> Tuple[str, str]:
        ip = request.client.host if request.client else "unknown"
        path = request.url.path
        if path.startswith("/portal"):
            group = "portal"
        elif path.startswith("/uploads"):
            group = "uploads"
        elif path.startswith("/auth"):
            group = "auth"
        else:
            group = "other"
        return (ip, group)

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)

        key = self._bucket_key(request)
        now = time.time()
        q = self.buckets[key]

        # drop old entries
        cutoff = now - self.window_sec
        while q and q[0] < cutoff:
            q.popleft()

        limit = self.burst if key[1] in ("auth","portal","uploads") else self.per_min

        if len(q) >= limit:
            return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)

        q.append(now)
        resp: Response = await call_next(request)
        return resp