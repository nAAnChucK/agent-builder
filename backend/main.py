import base64
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from api.build import router as build_router
from api.agents import router as agents_router

app = FastAPI(title="Agent Builder API", version="1.0.0")


class BasicAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        password = os.getenv("AUTH_PASSWORD", "")
        if not password:
            return await call_next(request)

        username = os.getenv("AUTH_USERNAME", "admin")
        auth = request.headers.get("Authorization", "")

        if auth.startswith("Basic "):
            try:
                decoded = base64.b64decode(auth[6:]).decode()
                user, _, pwd = decoded.partition(":")
                if secrets.compare_digest(user, username) and secrets.compare_digest(pwd, password):
                    return await call_next(request)
            except Exception:
                pass

        return Response(
            "Unauthorized",
            status_code=401,
            headers={"WWW-Authenticate": 'Basic realm="Agent Builder"'},
        )


app.add_middleware(BasicAuthMiddleware)

# CORS only needed in local dev (prod: same origin via static mount)
_dev_origins = [o for o in [
    os.getenv("CORS_ORIGIN"),
    "http://localhost:5173",
    "http://localhost:5174",
] if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_dev_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(build_router, prefix="/api")
app.include_router(agents_router, prefix="/api")

# Serve React build (production). html=True returns index.html for unknown paths.
_static = Path(__file__).parent / "static"
if _static.exists():
    app.mount("/", StaticFiles(directory=str(_static), html=True), name="static")
