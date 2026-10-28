"""Export the complete catalog and a reproducible full-pass coverage audit."""
import collections
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "data/research/all-name-meanings"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def source_urls(record):
    unique = {}
    candidates = [record.get("meaningSource"), *[r["url"] for r in record.get("meaningReferences", [])]]
    for url in candidates:
        if not url:
            continue
        parsed = urlsplit(url)
        assert parsed.scheme == "https" and parsed.netloc, url
        path = unquote(parsed.path)
        if parsed.hostname.endswith(".wiktionary.org") and path == "/w/index.php":
            title = parse_qs(parsed.query).get("title", [None])[0]
            if title:
                path = "/wiki/" + title.replace(" ", "_")
        key = (parsed.hostname.lower(), path, "" if path.startswith("/wiki/") else parsed.query)
        unique.setdefault(key, url)
    return list(unique.values())


catalog = read(ROOT / "src/data/catalog.json")["names"]
editorial = read(ROOT / "src/data/editorial.json")
results = read(DIR / "results.json")
manifest = read(DIR / "manifest.json")
assert hashlib.sha256((ROOT / "src/data/catalog.json").read_bytes()).hexdigest() == manifest["catalogSha256"]
assert len(catalog) == len({n["id"] for n in catalog}) == 2431
names = [{**n, **editorial.get(n["id"], {})} for n in catalog]
meanings = [n for n in names if n.get("meaning")]
assert len(meanings) == results["catalogMeanings"]
assert len(meanings) == manifest["initialMeaningCount"] + results["additionalMeanings"]
assert all(source_urls(n) for n in meanings)
assert all(len(r["lookups"]) >= 2 for r in results["records"])
assert not any(x["result"] == "transport_error_or_pending" for r in results["records"] for x in r["lookups"])

with (DIR / "catalog-with-meanings.csv").open("w", encoding="utf-8-sig", newline="") as handle:
    writer = csv.writer(handle)
    writer.writerow(["מזהה", "שם", "מגדר במקור", "פירוש", "מקור לשוני אפשרי", "מעמד הפירוש", "הסתייגות", "מספר ערכי מקור", "קישורים"])
    for record in names:
        urls = source_urls(record) if record.get("meaning") else []
        writer.writerow([record["id"], record["name"], "/".join({"girl": "בת", "boy": "בן"}.get(g, g) for g in record["genders"]),
            record.get("meaning", ""), record.get("origin", ""),
            {"possible": "אפשרי", "disputed": "שנוי במחלוקת", "documented": "מתועד"}.get(record.get("meaningStatus", "possible"), "אפשרי") if record.get("meaning") else "ללא פירוש שמור",
            record.get("meaningNote", ""), len(urls), "; ".join(urls)])

editorial_hash = hashlib.sha256((ROOT / "src/data/editorial.json").read_bytes()).hexdigest()
path = DIR / "pass-completion.json"
previous = read(path) if path.exists() else {}
completed_at = previous.get("completedAt") if previous.get("editorialSha256") == editorial_hash else dt.datetime.now(dt.timezone.utc).isoformat()
audit = {"startedAt": manifest["startedAt"], "completedAt": completed_at, "scope": "First full research pass over every initially unannotated catalog name",
    "catalogNames": len(names), "initialMeanings": manifest["initialMeaningCount"], "namesResearched": len(results["records"]),
    "addedMeanings": results["additionalMeanings"], "totalMeanings": len(meanings), "unresolved": len(names) - len(meanings),
    "coveragePercent": round(100 * len(meanings) / len(names), 2),
    "meaningStatuses": dict(collections.Counter(n.get("meaningStatus", "possible") for n in meanings)),
    "incompleteLookups": 0, "catalogSha256": manifest["catalogSha256"], "editorialSha256": editorial_hash,
    "sourceCountDefinition": "Distinct linked pages, never a confidence score or count of independent corroborations",
    "limitations": ["Possible transliteration matches and morphological analyses are explicitly qualified.",
        "Unresolved names may have meanings in sources outside the checked dictionaries.", "This pass is not an independent linguistic review."]}
path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(audit, ensure_ascii=False, indent=2))
