"""Materialize explicit, individually reviewed alias decisions. No automatic approval."""
import csv
import hashlib
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("full", Path(__file__).with_name("full-name-research.py"))
full = importlib.util.module_from_spec(spec)
spec.loader.exec_module(full)
path = full.DIR / "additional-candidates.tsv"
plan = full.read(full.DIR / "additional-review.json")
assert hashlib.sha256(path.read_bytes()).hexdigest() == plan["inputSha256"]
rows = list(csv.DictReader(path.open(encoding="utf-8"), delimiter="\t"))
cohort = {x["name"] for x in full.manifest()["records"]}
output = full.DIR / "reviewed-additional.tsv"
used = set()
for other in full.DIR.glob("reviewed*.tsv"):
    if other != output:
        for row in csv.DictReader(other.open(encoding="utf-8"), delimiter="\t"):
            used.update(row["names"].split("|"))
caches = {lang: full.cache(f"{lang}.wiktionary.org") for lang in ("he", "en")}
with output.open("w", encoding="utf-8", newline="") as handle:
    fields = ["names", "origin", "meaning", "sources", "note", "status"]
    writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t")
    writer.writeheader()
    for number in plan["approved"]:
        item = rows[number - 1]
        override = plan.get("overrides", {}).get(str(number), {})
        names = [n for n in dict.fromkeys(override.get("names", item["names"]).split("|")) if n in cohort and n not in used]
        if not names:
            continue
        sources = override.get("sources")
        if not sources:
            sources = ";".join("e:" + t for t in dict.fromkeys(item["titles"].split("|"))
                if caches["en"].get(t, {}).get("wikitext") or caches["en"].get(t, {}).get("structured"))
        assert sources, number
        meaning = override.get("meaning", item["candidate"])
        assert "מקור לא מוכרע" not in meaning, number
        writer.writerow({"names": "|".join(names), "origin": override.get("origin", item["origin"]),
            "meaning": meaning, "sources": sources, "status": override.get("status", "possible"),
            "note": override.get("note", "הפירוש מותנה בזיהוי התעתיק עם השם והמסורת שבמקורות. ייתכנו שמות דומים ממקורות אחרים; מספר הסימוכין אינו מדד לוודאות.")})
        used.update(names)
print(f"Materialized {len(plan['approved'])} explicit alias decisions")
