"""Trusted actor binding for Python SQLite maintenance and test connections.

Application HTTP handlers should use src/db/audit-context.cjs instead.
This helper does not authenticate an actor. Only trusted maintenance entry
points may supply it; never accept an untrusted request parameter.
"""
from __future__ import annotations

import re
import sqlite3

_VALID_ACTOR = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.@:-]{0,39}\Z')


def bind_audit_actor(conn: sqlite3.Connection, actor: str) -> None:
    if not isinstance(actor, str) or not _VALID_ACTOR.fullmatch(actor):
        raise ValueError('audit actor must be a trusted 1-40 character identifier')
    conn.create_function('audit_user', 0, lambda: actor, deterministic=False)
    conn.execute('PRAGMA foreign_keys = ON')
