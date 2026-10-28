"""Build the app's portable catalog from the 2024 CBS workbook.

Usage: python scripts/import-cbs.py data/raw/cbs-2024.xlsx
The input is deliberately not committed. Requires openpyxl.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

SOURCE = "https://www.cbs.gov.il/he/mediarelease/DocLib/2025/391/11_25_391t1.xlsx"
groups = ["יהודיות", "יהודים", "מוסלמיות", "מוסלמים", "נוצריות ערביות", "נוצרים ערבים", "דרוזיות", "דרוזים"]
names = {}


def published_count(value):
    """CBS stores some four-digit counts as comma-formatted text."""
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, str) and re.fullmatch(r"\d{1,3}(?:,\d{3})+", value):
        return int(value.replace(",", ""))
    return None


workbook = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
for index, sheet in enumerate(workbook.worksheets):
    gender = "girl" if index % 2 == 0 else "boy"
    for row in sheet.iter_rows(min_row=4, values_only=True):
        raw = row[0]
        if not isinstance(raw, str):
            continue
        name = unicodedata.normalize("NFC", raw.strip())
        if not name or len(name) > 40 or not re.search(r"[\u05d0-\u05ea]", name):
            continue
        # Keep names with a published count in at least one of the recent five years.
        recent = [published_count(value) for value in row[-5:]]
        if not any(x is not None and x >= 5 for x in recent):
            continue
        entry = names.setdefault(name, {"id": "cbs:" + name, "name": name, "genders": [], "observations": []})
        if gender not in entry["genders"]:
            entry["genders"].append(gender)
        value = published_count(row[-1])
        # '..' is suppressed and must not become zero or an invented total.
        if value is not None and value >= 5:
            entry["observations"].append({"group": groups[index], "gender": gender, "count": value, "year": 2024})

catalog = sorted(names.values(), key=lambda e: e["name"])
target = Path("src/data/catalog.json")
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({"source": SOURCE, "year": 2024, "names": catalog}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {len(catalog)} unique names to {target}")
