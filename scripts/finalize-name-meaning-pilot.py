"""Validate the 200 manually reviewed records, export an audit, optionally publish.

Research retrieval never determines whether a meaning is fit for publication.
The two TSVs are the manual decisions; the second records follow-up review.
"""
import argparse
import collections
import csv
import datetime as dt
import hashlib
import io
import json
import random
from pathlib import Path
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parents[1]
PILOT = ROOT / "data/research/name-meanings-200"
CACHE = ROOT / "data/raw/name-meanings-200"
LABELS = {
    "meaning_found": "נמצא פירוש עם מקור",
    "origin_only": "נמצא מקור השם; אין פירוש מוכרע",
    "needs_review": "נדרשת בדיקה נוספת",
    "not_found": "לא נמצא פירוש מבוסס",
}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_tsv(filename):
    with (PILOT / filename).open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))
    assert len({int(row["index"]) for row in rows}) == len(rows), filename
    assert all(set(row) == {"index", "status", "origin", "meaning", "sources", "note"} for row in rows)
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish", action="store_true", help="Merge sourced meanings into editorial.json")
    parser.add_argument("--finish", action="store_true", help="Record completion time, after checks")
    args = parser.parse_args()
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    sample = read_json(PILOT / "sample.json")
    catalog = read_json(ROOT / "src/data/catalog.json")["names"]
    editorial_path = ROOT / "src/data/editorial.json"
    editorial = read_json(editorial_path)
    base = read_tsv("reviewed.tsv")
    assert len(base) == 200 and [int(r["index"]) for r in base] == list(range(1, 201))
    final = {int(r["index"]): r for r in base}
    final.update({int(r["index"]): r for r in read_tsv("follow-up.tsv")})
    sample_ids = {r["id"] for r in sample["records"]}
    assert len(sample_ids) == len(sample["records"]) == 200
    prior_results = read_json(PILOT / "results.json") if (PILOT / "results.json").exists() else {}
    initial_excluded = prior_results.get("initialExcludedNameIds", [
        "cbs:אור", "cbs:הדר", "cbs:טל", "cbs:ים", "cbs:מעיין", "cbs:שחר",
    ])
    pool = [n for n in catalog if n["id"] not in initial_excluded and not n.get("meaning")]
    assert len(pool) == sample["populationSize"] == 2425
    assert [n["id"] for n in random.Random(sample["seed"]).sample(pool, 200)] == [r["id"] for r in sample["records"]]
    mapping = read_json(PILOT / "lookup-map.json")
    caches = [read_json(path) for path in CACHE.glob("*.json") if path.name != "sefaria-verses.json"]
    registry = {}
    request_counts = collections.Counter()
    for cache in caches:
        for attempt in cache.get("requests", []):
            request_counts[attempt["status"]] += 1

    def source(spec):
        prefix, value = spec.split(":", 1)
        if prefix == "u":
            url = value
            info = {
                "url": url, "publisher": urlparse(url).hostname,
                "reviewMethod": "Page or search extract read during the pilot; brief factual paraphrase only",
                "license": "Source license not asserted; no source article is redistributed",
            }
        else:
            site = {"h": "he.wiktionary.org", "e": "en.wiktionary.org"}[prefix]
            page = next((c["pages"][value] for c in caches
                         if c.get("site") == site and value in c.get("pages", {})
                         and not c["pages"][value].get("missing")
                         and c["pages"][value].get("wikitext")), None)
            if page is None:
                return None
            revision = page["revisions"][0]
            url = f"https://{site}/wiki/{quote(page['title'].replace(' ', '_'))}"
            info = {
                "url": url, "publisher": site, "title": page["title"],
                "revisionId": revision["revid"], "revisionAt": revision["timestamp"],
                "retrievedAt": page["retrievedAt"], "license": "CC-BY-SA-4.0",
                "attribution": f"Wiktionary contributors, {page['title']}, revision {revision['revid']}; Hebrew paraphrase/adaptation in this pilot",
                "revisionUrl": f"https://{site}/w/index.php?title={quote(page['title'])}&oldid={revision['revid']}",
            }
        assert urlparse(url).scheme == "https" and urlparse(url).hostname
        key = hashlib.sha256(url.encode()).hexdigest()[:16]
        registry[key] = info
        return key

    records = []
    for i, selection in enumerate(sample["records"], 1):
        decision = final[i]
        assert decision["status"] in LABELS
        record = {k: v for k, v in selection.items() if k not in ("status", "attempts")}
        record.update(index=i, status=decision["status"], initialStatus=base[i - 1]["status"],
                      origin=decision["origin"], notes=decision["note"], reviewedAt=now)
        record["sources"] = list(dict.fromkeys(filter(None, (source(s) for s in decision["sources"].split(";") if s))))
        record["lookups"] = []
        for site, entries in mapping.items():
            for title in entries.get(record["name"], []):
                page = next((c.get("pages", {}).get(title) for c in caches
                             if c.get("site") == site and title in c.get("pages", {})), None)
                record["lookups"].append({"site": site, "title": title,
                    "result": "transport_error_or_unfetched" if page is None else "missing_entry" if page.get("missing") else "entry_found"})
        exact = next((c.get("pages", {}).get(record["name"]) for c in caches
                      if c.get("site") == "he.wiktionary.org" and record["name"] in c.get("pages", {})), None)
        record["lookups"].insert(0, {"site": "he.wiktionary.org", "title": record["name"],
            "result": "transport_error_or_unfetched" if exact is None else "missing_entry" if exact.get("missing") else "entry_found"})
        if record["status"] == "meaning_found":
            assert decision["meaning"].strip() and record["sources"], record["name"]
            record["meaning"] = decision["meaning"]
            record["meaningSource"] = registry[record["sources"][0]]["url"]
            if args.publish:
                entry = editorial.setdefault(record["id"], {})
                assert not entry.get("meaning") or entry["meaning"] == record["meaning"], record["name"]
                entry.update(meaning=record["meaning"], origin=record["origin"], meaningSource=record["meaningSource"])
        elif record["status"] == "origin_only":
            record["originExplanation"] = decision["meaning"]
        elif decision["meaning"]:
            record["candidateMeaning"] = decision["meaning"]
        records.append(record)

    counts = dict(collections.Counter(r["status"] for r in records))
    initial_counts = dict(collections.Counter(r["initialStatus"] for r in records))
    finished_at = now if args.finish else prior_results.get("finishedAt")
    stop = dt.datetime.fromisoformat(finished_at or now)
    elapsed = (stop - dt.datetime.fromisoformat(sample["startedAt"].replace("Z", "+00:00"))).total_seconds()
    unreviewed = sample["populationSize"] - len(records)
    estimate = {
        "elapsedSeconds": round(elapsed, 1), "elapsedMinutes": round(elapsed / 60, 2),
        "secondsPerSampledName": round(elapsed / len(records), 2),
        "remainingUnreviewedNames": unreviewed,
        "linearHoursForSamePassOnRemaining": round(unreviewed * elapsed / len(records) / 3600, 2),
        "scope": "Wall-clock time includes setup, collection, semantic review, writing and validation; linear projection is for an equivalent research pass, not guaranteed meanings for every name.",
        "caveats": ["First-run setup can be reused", "Ambiguous spellings and disputed etymologies can require longer or remain unresolved", "origin_only is not counted as a found meaning", "No language expert has independently audited the full set"],
    }
    report = {**{k: v for k, v in sample.items() if k != "records"},
              "initialExcludedNameIds": initial_excluded,
              "catalogSha256": hashlib.sha256((ROOT / "src/data/catalog.json").read_bytes()).hexdigest(),
              "updatedAt": now, "finishedAt": finished_at, "counts": counts, "initialCounts": initial_counts,
              "requestCounts": dict(request_counts), "timing": estimate, "sourcesFile": "sources.json", "records": records}
    if args.publish:
        write_json(editorial_path, editorial)
    write_json(PILOT / "sources.json", registry)
    write_json(PILOT / "results.json", report)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["index", "id", "name", "status", "origin", "meaning_or_candidate", "source_urls", "notes"])
    for r in records:
        writer.writerow([r["index"], r["id"], r["name"], r["status"], r["origin"],
                         r.get("meaning", r.get("originExplanation", r.get("candidateMeaning", ""))),
                         " ; ".join(registry[s]["url"] for s in r["sources"]), r["notes"]])
    # csv.writer already emits CRLF; avoid translating it a second time on Windows.
    (PILOT / "results.csv").write_bytes(output.getvalue().encode("utf-8-sig"))
    lines = ["# מדגם פירושי שמות — 200 שמות", "", "28 באוקטובר 2026", "",
        f"נבחרו באקראי 200 מתוך 2,425 השמות שלא היה להם פירוש בתחילת הבדיקה. המדגם אחיד, ללא החזרה, ולא נבחר לפי שכיחות או לפי קלות המחקר.", "",
        "| תוצאה | מספר |", "| --- | ---: |"]
    lines += [f"| {label} | {counts.get(status, 0)} |" for status, label in LABELS.items()]
    lines += ["", f"נוספו לקובץ הפירושים {counts['meaning_found']} פירושים עם מקורות. יתר התוצאות נשמרו במחקר ולא הוצגו כפירושים שנבדקו.", "",
        f"זמן מדוד {'סופי' if finished_at else 'עדכון ביניים'}: **{elapsed / 60:.1f} דקות**, כולל הקמת תהליך האיסוף, בדיקת משמעויות, תיעוד ואימות.",
        f"השלכה ליניארית על 2,225 השמות שטרם נדגמו: **{estimate['linearHoursForSamePassOnRemaining']:.1f} שעות לסבב מחקר באותה רמת עומק**. זה אינו אומדן להשלמת פירוש ודאי לכל שם.", "",
        "ההקמה הראשונית ניתנת לשימוש חוזר. מנגד, שמות שכתיבם יכול לייצג כמה שפות, כינויי חיבה נדירים ואטימולוגיות שנויות במחלוקת דורשים טיפול נוסף. אין בסיס להבטיח פירוש יחיד לכל שם. שמות אלה נשמרים עם חלופות וסיבת החוסר.", "",
        "הפירושים הם תמציות לשוניות שנבדקו מול המקורות בזמן המדגם, ולעיתים פירושים אפשריים המותנים בקריאה או במסורת. אין כאן אישור של בלשן לכל הרשומות. משמעות של מילה אינה מוכיחה שכל אדם הנושא את השם נקרא על שמה.", "",
        "## קובצי המחקר", "",
        "- [תוצאות מלאות ב־JSON](../data/research/name-meanings-200/results.json): פירושים, סטטוסים, ניסיונות איתור וסיבות לאי־הכרעה.",
        "- [תוצאות ב־CSV](../data/research/name-meanings-200/results.csv): קובץ UTF-8 עם BOM לפתיחה גם בתוכנות טבלאיות.",
        "- [מקורות וגרסאות](../data/research/name-meanings-200/sources.json): קישורים, מזהי גרסה ורישיונות של מקורות ויקימילון.",
        "- [המדגם המקורי](../data/research/name-meanings-200/sample.json): סדר הדגימה והזרע לשחזור.", "",
        "## אופן הבדיקה והרישוי", "",
        "חיפוש מדויק בוויקימילון העברי, בדיקת צורות מקור וכתיבים חלופיים בוויקימילון האנגלי, ולאחר מכן חיפושים ממוקדים במילונים ובמקורות שמות. התאמה טכנית באיות אינה אישור לפירוש. שגיאות תעבורה נשמרו בנפרד מערכים חסרים; מקור שנכשל בגישה לא נספר כאילו אינו מכיל מידע.", "",
        "מקורות ויקימילון: ייחוס לעורכי הערך, קישור לגרסה שנבדקה ו־CC BY-SA 4.0 נשמרים בקובץ המקורות. התיאורים בעברית הם תמציות/עיבודים של הנתונים, ויש לשמר ייחוס ושיתוף זהה כשנדרש. במקורות אחרים נשמרו עובדות קצרות בניסוח חדש וקישור; אין כאן רישיון להעתיק את מאגרי האתרים או את מאמריהם. בפסוקי ספריא נבדק המקור העברי, ולא הופץ תרגום JPS ברישיון לא־מסחרי.", "",
        "לא שונו נתוני הלמ״ס, זהויות השמות, המגדרים או שכיחותם. שמות עם כמה קריאות אינם מאוחדים אוטומטית.", "",
        "## כל 200 התוצאות", "", "| # | שם | תוצאה | פירוש או ממצא | מקור |", "| ---: | --- | --- | --- | --- |"]
    for r in records:
        description = r.get("meaning", r.get("originExplanation", r.get("candidateMeaning", r["notes"])))
        links = " · ".join(f"[מקור {i + 1}]({registry[s]['url']})" for i, s in enumerate(r["sources"][:2])) or "—"
        lines.append(f"| {r['index']} | {r['name']} | {LABELS[r['status']]} | {description.replace('|', ' / ')} | {links} |")
    (ROOT / "docs/name-meaning-pilot.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"counts": counts, "initialCounts": initial_counts, "editorialMeanings": sum(bool(v.get('meaning')) for v in editorial.values()), "timing": estimate}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
