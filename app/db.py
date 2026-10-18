import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("MEDSTUDY_DATA", ROOT / "data")).resolve()
COURSES = [
    ("physiology", "生理学", "从稳态与调节理解生命活动", "01"),
    ("pathology", "病理学", "连接组织变化与疾病机制", "02"),
    ("cell-biology", "细胞生物学", "探索细胞结构与功能", "03"),
    ("biochemistry", "生物化学", "串联分子、代谢与调控", "04"),
]


@contextmanager
def connect():
    con = sqlite3.connect(DATA / "workbench.db", timeout=20)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init():
    DATA.mkdir(parents=True, exist_ok=True)
    for folder in ("uploads", "exports", "figures"):
        (DATA / folder).mkdir(exist_ok=True)
    with connect() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.executescript("""
        CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS materials (
          id TEXT PRIMARY KEY, course TEXT NOT NULL, title TEXT NOT NULL,
          kind TEXT NOT NULL, path TEXT NOT NULL, chunks TEXT NOT NULL,
          warnings TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY, course TEXT NOT NULL, kind TEXT NOT NULL,
          title TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS reviews (
          id TEXT PRIMARY KEY, course TEXT NOT NULL, question TEXT NOT NULL,
          answer TEXT NOT NULL, explanation TEXT NOT NULL, sources TEXT NOT NULL,
          due TEXT NOT NULL, stage INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS figures (
          id TEXT PRIMARY KEY, course TEXT NOT NULL, title TEXT NOT NULL,
          path TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
          labels TEXT NOT NULL DEFAULT '[]', confirmed INTEGER NOT NULL DEFAULT 0,
          created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS agent_threads (
          id TEXT PRIMARY KEY, course TEXT NOT NULL, title TEXT NOT NULL, data TEXT NOT NULL,
          created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        """)


def dumps(value):
    return json.dumps(value, ensure_ascii=False)
