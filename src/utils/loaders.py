import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_json(path: str):
    p = ROOT / path
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)
