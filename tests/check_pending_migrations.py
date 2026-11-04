import sqlite3
from pathlib import Path

db = Path("data/ci_test.db")
conn = sqlite3.connect(db)
try:
    applied = {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}
finally:
    conn.close()

expected = {
    p.name
    for p in Path("migrations").glob("*.sql")
    if not p.name.endswith(".down.sql")
}

pending = sorted(expected - applied)
if pending:
    print("PENDING MIGRATIONS:", pending)
    raise SystemExit(1)

print("All migrations applied.")