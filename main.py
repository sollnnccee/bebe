from datetime import date
from pathlib import Path
import hashlib
import hmac
import json
import os
import secrets

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware

load_dotenv()

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static" if (ROOT / "static").is_dir() else ROOT
DATA = (
    ROOT / "data" / "state.json"
    if (ROOT / "data" / "state.json").exists() or (ROOT / "static").is_dir()
    else ROOT / "state.json"
)

START = date(2026, 8, 24)
END = date(2026, 9, 23)

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
HTTPS_ONLY = os.environ.get("HTTPS", "").lower() in {"1", "true", "yes"}

app = FastAPI(title="The Last of Us Challenge")
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="tlou_admin",
    same_site="lax",
    https_only=HTTPS_ONLY,
    max_age=60 * 60 * 24 * 40,
)


class EntryIn(BaseModel):
    ok: bool
    seconds: float = Field(ge=0, le=120)
    note: str = ""


class LoginIn(BaseModel):
    password: str


def empty_state() -> dict:
    return {"user": "Игорь", "entries": {}}


def load_state() -> dict:
    if not DATA.exists():
        return empty_state()
    return json.loads(DATA.read_text(encoding="utf-8"))


def save_state(state: dict) -> None:
    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def is_admin(request: Request) -> bool:
    return bool(request.session.get("admin"))


def require_admin(request: Request) -> None:
    if not is_admin(request):
        raise HTTPException(401, "Нужен вход")


def password_ok(password: str) -> bool:
    if not ADMIN_PASSWORD or not password:
        return False
    given = hashlib.sha256(password.encode("utf-8")).digest()
    real = hashlib.sha256(ADMIN_PASSWORD.encode("utf-8")).digest()
    return hmac.compare_digest(given, real)


def first_file(*paths: Path) -> Path | None:
    for path in paths:
        if path.is_file():
            return path
    return None


@app.get("/")
async def index() -> FileResponse:
    page = first_file(ROOT / "static" / "index.html", ROOT / "index.html")
    if page is None:
        raise HTTPException(404, "index.html не найден")
    return FileResponse(page)


@app.get("/static/img/{name}")
async def image(name: str) -> FileResponse:
    safe = Path(name).name
    found = first_file(
        ROOT / "static" / "img" / safe,
        ROOT / safe,
        ROOT / "static" / safe,
    )
    if found is None:
        raise HTTPException(404)
    return FileResponse(found)


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/api/me")
def me(request: Request) -> dict:
    return {"admin": is_admin(request)}


@app.post("/api/login")
def login(request: Request, body: LoginIn) -> dict:
    if not password_ok(body.password):
        raise HTTPException(401, "Неверный пароль")
    request.session["admin"] = True
    return {"admin": True}


@app.post("/api/logout")
def logout(request: Request) -> dict:
    request.session.clear()
    return {"admin": False}


@app.get("/api/state")
def get_state() -> dict:
    return load_state()


@app.put("/api/entries/{day}")
def upsert_entry(day: str, entry: EntryIn, request: Request) -> dict:
    require_admin(request)
    try:
        parsed = date.fromisoformat(day)
    except ValueError as exc:
        raise HTTPException(400, "Некорректная дата") from exc
    if parsed < START or parsed > END:
        raise HTTPException(400, "Дата вне челленджа")
    state = load_state()
    state.setdefault("entries", {})[day] = entry.model_dump()
    save_state(state)
    return state


@app.delete("/api/entries/{day}")
def delete_entry(day: str, request: Request) -> dict:
    require_admin(request)
    state = load_state()
    state.setdefault("entries", {}).pop(day, None)
    save_state(state)
    return state
