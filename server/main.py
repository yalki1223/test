"""SoundCloud Friends Listening — local FastAPI server.

Stores users, their current listening status and friend relationships in a
SQLite database. The Chrome extension talks to this server via HTTP from the
local machine.

Auth model is intentionally simple: on first launch the extension calls
`POST /api/register` with a chosen username and receives a `user_token`. The
token is sent in the `X-User-Token` header for every subsequent request.
"""

from __future__ import annotations

import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).resolve().parent / "data.db"

# How long a status is considered "live" (seconds). After that the user is
# treated as offline and not shown in the friends-listening feed.
STATUS_TTL_SECONDS = 90


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
                token         TEXT NOT NULL UNIQUE,
                avatar_url    TEXT,
                created_at    INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS statuses (
                user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                track_title   TEXT,
                track_artist  TEXT,
                track_url     TEXT,
                artwork_url   TEXT,
                updated_at    INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS friend_requests (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                from_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                to_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at    INTEGER NOT NULL,
                UNIQUE(from_user_id, to_user_id)
            );

            CREATE TABLE IF NOT EXISTS friendships (
                user_a_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                user_b_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at    INTEGER NOT NULL,
                PRIMARY KEY (user_a_id, user_b_id),
                CHECK (user_a_id < user_b_id)
            );
            """
        )


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #


class RegisterIn(BaseModel):
    username: str = Field(min_length=2, max_length=40)
    avatar_url: Optional[str] = None


class RegisterOut(BaseModel):
    user_id: int
    username: str
    token: str


class StatusIn(BaseModel):
    track_title: Optional[str] = Field(default=None, max_length=300)
    track_artist: Optional[str] = Field(default=None, max_length=300)
    track_url: Optional[str] = Field(default=None, max_length=500)
    artwork_url: Optional[str] = Field(default=None, max_length=500)


class UserPublic(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None


class TrackInfo(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    url: Optional[str] = None
    artwork_url: Optional[str] = None
    updated_at: Optional[int] = None
    is_live: bool = False


class FriendListening(BaseModel):
    user: UserPublic
    track: TrackInfo


class FriendRequestPublic(BaseModel):
    id: int
    user: UserPublic
    created_at: int


class FriendRequestCreate(BaseModel):
    username: str


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _row_to_public(row: sqlite3.Row) -> UserPublic:
    return UserPublic(id=row["id"], username=row["username"], avatar_url=row["avatar_url"])


def _ordered_pair(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


def get_current_user(x_user_token: Optional[str] = Header(default=None)) -> sqlite3.Row:
    if not x_user_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-User-Token header")
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE token = ?", (x_user_token,)).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown token")
    return row


# --------------------------------------------------------------------------- #
# App
# --------------------------------------------------------------------------- #


app = FastAPI(title="SoundCloud Friends Listening", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "time": int(time.time())}


# ---- registration / profile ---------------------------------------------- #


@app.post("/api/register", response_model=RegisterOut)
def register(payload: RegisterIn) -> RegisterOut:
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Empty username")
    token = secrets.token_urlsafe(24)
    now = int(time.time())
    with db() as conn:
        existing = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        cur = conn.execute(
            "INSERT INTO users (username, token, avatar_url, created_at) VALUES (?,?,?,?)",
            (username, token, payload.avatar_url, now),
        )
        user_id = int(cur.lastrowid)
    return RegisterOut(user_id=user_id, username=username, token=token)


@app.get("/api/me", response_model=UserPublic)
def me(user: sqlite3.Row = Depends(get_current_user)) -> UserPublic:
    return _row_to_public(user)


# ---- listening status ----------------------------------------------------- #


@app.post("/api/status")
def push_status(payload: StatusIn, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    now = int(time.time())
    with db() as conn:
        conn.execute(
            """
            INSERT INTO statuses (user_id, track_title, track_artist, track_url, artwork_url, updated_at)
            VALUES (?,?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
                track_title=excluded.track_title,
                track_artist=excluded.track_artist,
                track_url=excluded.track_url,
                artwork_url=excluded.artwork_url,
                updated_at=excluded.updated_at
            """,
            (
                user["id"],
                payload.track_title,
                payload.track_artist,
                payload.track_url,
                payload.artwork_url,
                now,
            ),
        )
    return {"ok": True, "updated_at": now}


@app.get("/api/friends/listening", response_model=list[FriendListening])
def friends_listening(user: sqlite3.Row = Depends(get_current_user)) -> list[FriendListening]:
    cutoff = int(time.time()) - STATUS_TTL_SECONDS
    with db() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.username, u.avatar_url,
                   s.track_title, s.track_artist, s.track_url, s.artwork_url, s.updated_at
            FROM friendships f
            JOIN users u ON u.id = CASE
                WHEN f.user_a_id = :me THEN f.user_b_id
                ELSE f.user_a_id
            END
            LEFT JOIN statuses s ON s.user_id = u.id
            WHERE f.user_a_id = :me OR f.user_b_id = :me
            ORDER BY s.updated_at DESC NULLS LAST, u.username COLLATE NOCASE
            """,
            {"me": user["id"]},
        ).fetchall()

    out: list[FriendListening] = []
    for row in rows:
        updated = row["updated_at"]
        is_live = bool(updated and updated >= cutoff and row["track_title"])
        out.append(
            FriendListening(
                user=UserPublic(id=row["id"], username=row["username"], avatar_url=row["avatar_url"]),
                track=TrackInfo(
                    title=row["track_title"],
                    artist=row["track_artist"],
                    url=row["track_url"],
                    artwork_url=row["artwork_url"],
                    updated_at=updated,
                    is_live=is_live,
                ),
            )
        )
    return out


# ---- friends ------------------------------------------------------------- #


@app.get("/api/friends", response_model=list[UserPublic])
def list_friends(user: sqlite3.Row = Depends(get_current_user)) -> list[UserPublic]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.username, u.avatar_url
            FROM friendships f
            JOIN users u ON u.id = CASE
                WHEN f.user_a_id = :me THEN f.user_b_id
                ELSE f.user_a_id
            END
            WHERE f.user_a_id = :me OR f.user_b_id = :me
            ORDER BY u.username COLLATE NOCASE
            """,
            {"me": user["id"]},
        ).fetchall()
    return [_row_to_public(r) for r in rows]


class RemoveFriendIn(BaseModel):
    user_id: int


@app.post("/api/friends/remove")
def remove_friend(payload: RemoveFriendIn, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    a, b = _ordered_pair(int(user["id"]), int(payload.user_id))
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM friendships WHERE user_a_id = ? AND user_b_id = ?", (a, b)
        )
        deleted = cur.rowcount
    return {"ok": True, "deleted": deleted}


# ---- friend requests ----------------------------------------------------- #


@app.post("/api/friends/request")
def send_friend_request(
    payload: FriendRequestCreate, user: sqlite3.Row = Depends(get_current_user)
) -> dict:
    target_username = payload.username.strip()
    if not target_username:
        raise HTTPException(status_code=400, detail="Empty username")
    if target_username.lower() == user["username"].lower():
        raise HTTPException(status_code=400, detail="Нельзя добавить самого себя")
    now = int(time.time())
    with db() as conn:
        target = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (target_username,)
        ).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        a, b = _ordered_pair(int(user["id"]), int(target["id"]))
        already_friends = conn.execute(
            "SELECT 1 FROM friendships WHERE user_a_id = ? AND user_b_id = ?", (a, b)
        ).fetchone()
        if already_friends:
            raise HTTPException(status_code=409, detail="Вы уже друзья")

        # If the other user already sent us a request — accept it instead of
        # creating a duplicate in the opposite direction.
        reverse = conn.execute(
            "SELECT * FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
            (target["id"], user["id"]),
        ).fetchone()
        if reverse:
            conn.execute(
                "DELETE FROM friend_requests WHERE id = ?", (reverse["id"],)
            )
            conn.execute(
                "INSERT INTO friendships (user_a_id, user_b_id, created_at) VALUES (?,?,?)",
                (a, b, now),
            )
            return {"ok": True, "auto_accepted": True}

        existing = conn.execute(
            "SELECT 1 FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
            (user["id"], target["id"]),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Заявка уже отправлена")

        conn.execute(
            "INSERT INTO friend_requests (from_user_id, to_user_id, created_at) VALUES (?,?,?)",
            (user["id"], target["id"], now),
        )
    return {"ok": True, "auto_accepted": False}


@app.get("/api/friends/requests/incoming", response_model=list[FriendRequestPublic])
def incoming_requests(user: sqlite3.Row = Depends(get_current_user)) -> list[FriendRequestPublic]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT fr.id, fr.created_at, u.id AS uid, u.username, u.avatar_url
            FROM friend_requests fr
            JOIN users u ON u.id = fr.from_user_id
            WHERE fr.to_user_id = ?
            ORDER BY fr.created_at DESC
            """,
            (user["id"],),
        ).fetchall()
    return [
        FriendRequestPublic(
            id=row["id"],
            created_at=row["created_at"],
            user=UserPublic(id=row["uid"], username=row["username"], avatar_url=row["avatar_url"]),
        )
        for row in rows
    ]


@app.get("/api/friends/requests/outgoing", response_model=list[FriendRequestPublic])
def outgoing_requests(user: sqlite3.Row = Depends(get_current_user)) -> list[FriendRequestPublic]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT fr.id, fr.created_at, u.id AS uid, u.username, u.avatar_url
            FROM friend_requests fr
            JOIN users u ON u.id = fr.to_user_id
            WHERE fr.from_user_id = ?
            ORDER BY fr.created_at DESC
            """,
            (user["id"],),
        ).fetchall()
    return [
        FriendRequestPublic(
            id=row["id"],
            created_at=row["created_at"],
            user=UserPublic(id=row["uid"], username=row["username"], avatar_url=row["avatar_url"]),
        )
        for row in rows
    ]


class RequestActionIn(BaseModel):
    request_id: int


@app.post("/api/friends/requests/accept")
def accept_request(payload: RequestActionIn, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    with db() as conn:
        req = conn.execute(
            "SELECT * FROM friend_requests WHERE id = ?", (payload.request_id,)
        ).fetchone()
        if not req or req["to_user_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="Заявка не найдена")
        a, b = _ordered_pair(int(req["from_user_id"]), int(req["to_user_id"]))
        conn.execute(
            """
            INSERT OR IGNORE INTO friendships (user_a_id, user_b_id, created_at)
            VALUES (?,?,?)
            """,
            (a, b, int(time.time())),
        )
        conn.execute("DELETE FROM friend_requests WHERE id = ?", (payload.request_id,))
    return {"ok": True}


@app.post("/api/friends/requests/decline")
def decline_request(payload: RequestActionIn, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    with db() as conn:
        req = conn.execute(
            "SELECT * FROM friend_requests WHERE id = ?", (payload.request_id,)
        ).fetchone()
        if not req or req["to_user_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="Заявка не найдена")
        conn.execute("DELETE FROM friend_requests WHERE id = ?", (payload.request_id,))
    return {"ok": True}


@app.post("/api/friends/requests/cancel")
def cancel_request(payload: RequestActionIn, user: sqlite3.Row = Depends(get_current_user)) -> dict:
    with db() as conn:
        req = conn.execute(
            "SELECT * FROM friend_requests WHERE id = ?", (payload.request_id,)
        ).fetchone()
        if not req or req["from_user_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="Заявка не найдена")
        conn.execute("DELETE FROM friend_requests WHERE id = ?", (payload.request_id,))
    return {"ok": True}


# ---- search -------------------------------------------------------------- #


@app.get("/api/users/search", response_model=list[UserPublic])
def search_users(q: str, user: sqlite3.Row = Depends(get_current_user)) -> list[UserPublic]:
    q = q.strip()
    if len(q) < 2:
        return []
    with db() as conn:
        rows = conn.execute(
            """
            SELECT id, username, avatar_url
            FROM users
            WHERE username LIKE ? COLLATE NOCASE AND id != ?
            ORDER BY username COLLATE NOCASE
            LIMIT 20
            """,
            (f"%{q}%", user["id"]),
        ).fetchall()
    return [_row_to_public(r) for r in rows]
