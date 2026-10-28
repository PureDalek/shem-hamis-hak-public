"""Publish the explicitly authored, qualified morphological proposals."""
import csv
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("full", Path(__file__).with_name("full-name-research.py"))
full = importlib.util.module_from_spec(spec)
spec.loader.exec_module(full)
destination = full.DIR / "reviewed-compounds.tsv"
used = set()
for path in full.DIR.glob("reviewed*.tsv"):
    if path != destination:
        for row in csv.DictReader(path.open(encoding="utf-8"), delimiter="\t"):
            used.update(row["names"].split("|"))
cohort = {r["name"] for r in full.manifest()["records"]}
with destination.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=["names", "origin", "meaning", "sources", "note", "status"], delimiter="\t")
    writer.writeheader()
    for row in csv.DictReader((full.DIR / "compound-analyses.tsv").open(encoding="utf-8"), delimiter="\t"):
        names = [n for n in row["names"].split("|") if n in cohort and n not in used]
        if not names:
            continue
        writer.writerow({"names": "|".join(names), "origin": "ניתוח לשוני מוצע; עברית או שפה המצוינת בפירוש",
            "meaning": row["meaning"], "sources": row["sources"], "status": "possible",
            "note": "זהו ניתוח לשוני מוצע או זיהוי של וריאציית כתיב. המקורות מתעדים את המילים, הרכיבים או שם הבסיס; הם אינם הוכחה לאטימולוגיה של השם המלא או לכוונת מי שבחר בו. ייתכנו מקורות אחרים."})
        used.update(names)
print("Prepared qualified morphological analyses")
