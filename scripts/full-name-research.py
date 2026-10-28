"""Resumable dictionary research across every remaining catalog name.

Collection is separate from editorial approval. Only reviewed.tsv is publishable.
Raw dictionary responses stay ignored; portable results retain source revisions.
"""
import argparse
import csv
import datetime as dt
import hashlib
import json
import re
import time
from pathlib import Path
from urllib.parse import quote
import xml.etree.ElementTree as ET

import requests

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "data/research/all-name-meanings"
RAW = ROOT / "data/raw/all-name-meanings"
MEANING_FIELDS = ["meaning", "origin", "meaningStatus", "meaningNote", "meaningSource", "meaningReferences"]


def fingerprint(entry):
    payload = {key: entry.get(key) for key in MEANING_FIELDS}
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def manifest():
    path = DIR / "manifest.json"
    if path.exists():
        return read(path)
    catalog = read(ROOT / "src/data/catalog.json")["names"]
    editorial = read(ROOT / "src/data/editorial.json")
    data = {"startedAt": now(), "initialMeaningCount": 178,
            "catalogSha256": hashlib.sha256((ROOT / "src/data/catalog.json").read_bytes()).hexdigest(),
            "records": [n for n in catalog if not n.get("meaning") and not editorial.get(n["id"], {}).get("meaning")]}
    assert len(data["records"]) == 2253
    # Keep population/gender context for disambiguation, without duplicating statistics.
    data["records"] = [{"id": n["id"], "name": n["name"], "genders": n["genders"],
                        "groups": sorted({o["group"] for o in n["observations"]})} for n in data["records"]]
    write(path, data)
    return data


def cache(site):
    pages = {}
    for folder in (ROOT / "data/raw/name-meanings-200", RAW):
        for path in folder.glob("*.json"):
            if path.name.startswith(("kaikki-", "baby-maker-", "name-db")):
                continue
            data = read(path)
            if isinstance(data, dict) and data.get("site") == site:
                for title, page in data.get("pages", {}).items():
                    if pages.get(title, {}).get("wikitext") and not page.get("wikitext"):
                        continue
                    pages[title] = page
    return pages


def fetch(site, titles):
    path = RAW / f"{site}.json"
    data = read(path) if path.exists() else {"site": site, "license": "CC-BY-SA-4.0", "pages": {}, "requests": []}
    prior = cache(site)
    pending = [t for t in dict.fromkeys(titles) if t not in prior
        or not (prior[t].get("missing") or prior[t].get("wikitext") or prior[t].get("structured"))
        # Language-specific extracts are partial: a Turkish record for Helen
        # must not suppress checking the complete English Wiktionary page.
        or (re.match(r"^[A-Za-z]", t) and prior[t].get("structured") and not prior[t].get("wikitext"))]
    session = requests.Session()
    session.headers["User-Agent"] = "NaMeCatalogResearch/0.2 (public dictionary research; read only)"
    for offset in range(0, len(pending), 50):
        batch = pending[offset:offset + 50]
        attempt = {"at": now(), "titles": batch}
        try:
            response = session.get(f"https://{site}/w/api.php", params={
                "action": "query", "format": "json", "formatversion": 2, "maxlag": 5,
                "titles": "|".join(batch), "prop": "revisions", "redirects": 1,
                "rvprop": "ids|timestamp|content", "rvslots": "main",
            }, timeout=45)
            response.raise_for_status()
            query = response.json()["query"]
            pages = {p["title"]: p for p in query["pages"]}
            aliases = {p["from"]: p["to"] for p in query.get("normalized", []) + query.get("redirects", [])}
            for title in batch:
                canonical = title
                seen = set()
                while canonical in aliases and canonical not in seen:
                    seen.add(canonical)
                    canonical = aliases[canonical]
                page = pages.get(canonical)
                if page is None:
                    continue
                page = dict(page)
                for revision in page.get("revisions", []):
                    page["wikitext"] = revision.get("slots", {}).get("main", {}).get("content", "")
                page["revisions"] = [{"revid": r["revid"], "timestamp": r["timestamp"]} for r in page.get("revisions", [])]
                data["pages"][title] = {**page, "retrievedAt": now()}
            attempt["status"] = "ok"
        except (requests.RequestException, KeyError, ValueError) as error:
            attempt.update(status="error", error=str(error))
        data["requests"].append(attempt)
        write(path, data)
        print(f"{site}: {min(offset+50,len(pending))}/{len(pending)} {attempt['status']}", flush=True)
        if attempt["status"] == "error":
            # Do not hammer an unavailable or rate-limited source.
            break
        time.sleep(13)


def mappings():
    path = DIR / "lookup-map.json"
    return read(path) if path.exists() else {}


def index_extracts():
    needed = {r["name"] for r in manifest()["records"]}
    needed.update(t for m in mappings().values() for titles in m.values() for t in titles)
    for path in DIR.glob("reviewed*.tsv"):
        with path.open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle, delimiter="\t"):
                needed.update(s.split(":", 1)[1] for s in row["sources"].split(";") if s.startswith("e:"))
    pages = {}
    for path in RAW.glob("kaikki-*.json"):
        data = read(path)
        for title in needed:
            records = data["entries"].get(title)
            if records:
                page = pages.setdefault(title, {"title": records[0]["word"], "structured": [], "extractSources": []})
                page["structured"].extend(records)
                page["extractSources"].append({k: v for k, v in data.items() if k != "entries"})
    write(RAW / "structured-en.json", {"site": "en.wiktionary.org", "pages": pages})
    print(f"Indexed structured dictionary evidence for {len(pages)} lookup titles")


def strong_entries():
    path = RAW / "StrongHebrewG.xml"
    if not path.exists():
        return {}
    ns = {"o": "http://www.bibletechnologies.net/2003/OSIS/namespace"}
    entries = {}
    for entry in ET.parse(path).findall(".//o:div[@type='entry']", ns):
        word = entry.find("o:w", ns)
        if word is not None:
            # Only the public-domain Strong material, not TWOT numbers/notes.
            body = [" ".join(x.itertext()) for x in entry.findall("o:note", ns)
                    if x.get("type") in ("exegesis", "explanation")]
            entries[word.get("ID")] = f"{word.text} {' '.join(body)}"
    return entries


def finalize(publish=False):
    cohort = manifest()
    assert hashlib.sha256((ROOT / "src/data/catalog.json").read_bytes()).hexdigest() == cohort["catalogSha256"], "Catalog changed since this cohort was created"
    mapping = mappings()
    caches = {p: cache(f"{p}.wiktionary.org") for p in ("he", "en")}
    strong = strong_entries()
    editorial_path = ROOT / "src/data/editorial.json"
    editorial = read(editorial_path)
    state_path = DIR / "publication-state.json"
    prior_path = DIR / "results.json"
    if state_path.exists():
        prior = read(state_path)["records"]
    else:
        # One-time migration from the earlier results journal. Subsequent
        # dry runs never replace the last-published fingerprints.
        prior = {r["id"]: {"name": r["name"], "fingerprint": fingerprint(r)}
                 for r in read(prior_path)["records"] if r.get("meaning")} if prior_path.exists() else {}
    registry, approved = {}, {}
    for path in sorted(DIR.glob("reviewed*.tsv")):
        with path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle, delimiter="\t"):
                assert row["meaning"].strip() and row["note"].strip(), row
                assert row["meaning"].strip() not in ["שם שפירושו לא מוכרע", "מספר מקורות אפשריים", "מקור לא מוכרע", "פירוש לא מוכרע", "משמעות לא מוכרעת"], row
                status = row.get("status") or "possible"
                assert status in ["documented", "possible", "disputed"]
                refs = []
                for spec in row["sources"].split(";"):
                    prefix, title = spec.split(":", 1)
                    if prefix == "p":
                        # Reuse an already reviewed primary-text citation from
                        # the pilot without inventing a dictionary revision.
                        source = read(ROOT / "data/research/name-meanings-200/sources.json")[title]
                        url = source["url"]
                        assert url.startswith("https://www.sefaria.org/"), spec
                        registry[spec] = {**source, "reusedFrom": "name-meanings-200/sources.json"}
                        label = "מקרא · טקסט בספריא"
                    elif prefix == "s":
                        assert title in strong, spec
                        url = f"https://biblehub.com/hebrew/{title.removeprefix('H')}.htm"
                        registry[spec] = {"url": url, "publisher": "James Strong; digital edition by David Troidl and David Instone-Brewer",
                            "title": title, "license": "Public Domain (XML source declaration)",
                            "dataSource": "https://github.com/openscriptures/strongs/blob/master/hebrew/StrongHebrewG.xml",
                            "sourceFileSha256": hashlib.sha256((RAW / "StrongHebrewG.xml").read_bytes()).hexdigest(),
                            "scope": "Traditional lexicon etymology, not a modern linguistic consensus"}
                        label = f"מילון סטרונג · {title}"
                    else:
                        lang = {"h": "he", "e": "en"}[prefix]
                        page = caches[lang].get(title)
                        assert page and (page.get("wikitext") or page.get("structured")) and not page.get("missing"), spec
                        url = f"https://{lang}.wiktionary.org/wiki/{quote(page['title'].replace(' ', '_'))}"
                        if page.get("revisions"):
                            revision = page["revisions"][0]
                            registry[spec] = {"url": url, "title": page["title"], "publisher": f"{lang}.wiktionary.org",
                                "revisionId": revision["revid"], "revisionAt": revision["timestamp"], "retrievedAt": page["retrievedAt"],
                                "license": "CC-BY-SA-4.0", "attribution": f"Wiktionary contributors, {page['title']}, revision {revision['revid']}; Hebrew adaptation",
                                "revisionUrl": f"https://{lang}.wiktionary.org/w/index.php?title={quote(page['title'])}&oldid={revision['revid']}"}
                        else:
                            registry[spec] = {"url": url, "title": page["title"], "publisher": "en.wiktionary.org",
                                "license": "CC-BY-SA-4.0", "attribution": f"Wiktionary contributors, {page['title']}; Hebrew adaptation; structured extract via Tatu Ylonen's Wiktextract/Kaikki",
                                "extractSources": page["extractSources"], "reviewedAt": now()}
                        label = f"ויקימילון ({'עברית' if lang == 'he' else 'אנגלית'}) · {page['title']}"
                    refs.append({"url": url, "label": label})
                for name in row["names"].split("|"):
                    assert name not in approved, name
                    approved[name] = {"meaning": row["meaning"], "origin": row["origin"], "meaningStatus": status,
                        "meaningNote": row["note"], "meaningSource": refs[0]["url"], "meaningReferences": refs,
                        "sourceKeys": row["sources"].split(";")}
    valid_names = {r["name"] for r in cohort["records"]}
    assert set(approved) <= valid_names, set(approved) - valid_names
    if publish:
        # Revoke only our own unchanged text if a manual approval is withdrawn.
        for id, previous in prior.items():
            if previous["name"] in approved:
                continue
            entry = editorial.get(id, {})
            assert fingerprint(entry) == previous["fingerprint"], f"Locally edited revoked entry: {id}"
            for key in MEANING_FIELDS:
                entry.pop(key, None)
            if not entry:
                editorial.pop(id, None)
    records = []
    for name in cohort["records"]:
        lookups = []
        for prefix, lang in [("h", "he"), ("e", "en")]:
            for title in dict.fromkeys([name["name"], *mapping.get(name["name"], {}).get(lang, [])]):
                page = caches[lang].get(title)
                lookups.append({"site": f"{lang}.wiktionary.org", "title": title,
                    "result": "transport_error_or_pending" if page is None else "missing_entry" if page.get("missing") else "entry_found"})
        details = approved.get(name["name"])
        status = "meaning_found" if details else "unresolved_with_dictionary_evidence" if any(x["result"] == "entry_found" for x in lookups) else "lookup_incomplete" if any(x["result"] == "transport_error_or_pending" for x in lookups) else "no_match_in_checked_sources"
        record = {**name, "status": status, "lookups": lookups}
        if not details:
            record["assessment"] = (
                "An entry or candidate word was found, but no adequately supported interpretation was approved. Entries may document only the name, an uncertain etymology, or a homograph. Further source validation is required."
                if status == "unresolved_with_dictionary_evidence" else
                "No matching entry was found in the exact-spelling and explicitly mapped lookups recorded here. This does not establish that the name has no meaning or that no source exists."
                if status == "no_match_in_checked_sources" else
                "At least one recorded lookup is incomplete; no meaning was inferred from a failed request.")
        if details:
            record.update(details)
            if publish:
                entry = editorial.setdefault(name["id"], {})
                previous = prior.get(name["id"], {})
                unchanged_since_our_last_pass = previous and fingerprint(entry) == previous["fingerprint"]
                assert not entry.get("meaning") or entry["meaning"] == details["meaning"] or unchanged_since_our_last_pass, name["name"]
                entry.update({k: v for k, v in details.items() if k != "sourceKeys"})
        records.append(record)
    from collections import Counter
    summary = {"startedAt": cohort["startedAt"], "updatedAt": now(), "cohortSize": len(records),
        "counts": dict(Counter(r["status"] for r in records)), "additionalMeanings": len(approved),
        "catalogMeanings": sum(bool(v.get("meaning")) for v in editorial.values()),
        "sourceCountDefinition": "Distinct linked source pages; not certainty or independent corroboration",
        "publicationMode": "published" if publish else "review_only",
        "catalogSha256": cohort["catalogSha256"],
        "coverage": "Every initially unannotated name has an exact-spelling lookup and, where explicitly authored, alias lookups. An unresolved result is not a claim that no meaning exists. This is a first full research pass, not an independent linguistic audit."}
    write(DIR / "results.json", {**summary, "records": records})
    write(DIR / "sources.json", registry)
    write(DIR / "summary.json", summary)
    with (DIR / "results.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        out = csv.writer(handle)
        out.writerow(["שם", "מצב מחקר", "מקור לשוני", "פירוש", "הסתייגות", "מספר ערכי מקור", "סימוכין"])
        for r in records:
            urls = list(dict.fromkeys(ref["url"] for ref in r.get("meaningReferences", [])))
            out.writerow([r["name"], {"meaning_found": "נשמר פירוש עם סימוכין", "unresolved_with_dictionary_evidence": "נמצא מידע אך לא אושר פירוש", "lookup_incomplete": "בדיקה לא הושלמה", "no_match_in_checked_sources": "לא נמצאה התאמה במקורות שנבדקו"}[r["status"]], r.get("origin", ""), r.get("meaning", ""), r.get("meaningNote", ""), len(urls), "; ".join(urls)])
    if publish:
        write(editorial_path, editorial)
        write(state_path, {"publishedAt": now(), "records": {r["id"]: {"name": r["name"], "fingerprint": fingerprint(r)} for r in records if r.get("meaning")}})
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def compact(page, site, limit):
    if page.get("structured"):
        return " / ".join(f"[{r['lang']}] ETY {r.get('etymology_text','')[:800]} DEF " +
            " / ".join("; ".join(s.get("glosses", [])) for s in r.get("senses", []))[:700]
            for r in page["structured"])[:limit]
    text = page.get("wikitext", "")
    if site.startswith("he."):
        lines = [l for l in text.splitlines() if re.match(r"^==[^=]|^#(?![:*])|^\*", l)]
        return " / ".join(lines)[:limit]
    parts = re.split(r"(?m)^==([^=\n]+)==\s*$", text)
    lines = []
    for j in range(1, len(parts), 2):
        lang, content = parts[j].strip(), parts[j+1]
        ety = re.findall(r"(?ms)^={3,}Etymology[^\n]*\n(.*?)(?=^===|\Z)", content)
        definitions = re.findall(r"(?m)^# (.+)$", content)
        lines.append(f"[{lang}] ETY {' / '.join(t.strip() for t in ety)[:800]} DEF {' / '.join(definitions)[:600]}")
    return " / ".join(lines)[:limit]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["init", "fetch", "review", "finalize", "index-extracts"])
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--site", choices=["he", "en"], default="he")
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--stop", type=int, default=2253)
    parser.add_argument("--limit", type=int, default=1600)
    args = parser.parse_args()
    records = manifest()["records"]
    mapping = mappings()
    if args.mode == "index-extracts":
        index_extracts()
    elif args.mode == "finalize":
        finalize(args.publish)
    elif args.mode == "init":
        print(f"Manifest saved: {len(records)} names without meanings")
    elif args.mode == "fetch":
        titles = [t for item in mapping.values() for t in item.get(args.site, [])]
        titles += [r["name"] for r in records]
        fetch(f"{args.site}.wiktionary.org", titles)
    else:
        caches = {prefix: cache(f"{prefix}.wiktionary.org") for prefix in ("he", "en")}
        for i, r in enumerate(records, 1):
            if not args.start <= i <= args.stop:
                continue
            print(f"\n### {i} {r['name']} {','.join(r['groups'])}")
            for prefix in ("he", "en"):
                for title in dict.fromkeys([r["name"], *mapping.get(r["name"], {}).get(prefix, [])]):
                    page = caches[prefix].get(title, {})
                    if page.get("wikitext") or page.get("structured"):
                        print(f"{prefix}:{title}: {compact(page,prefix+'.wiktionary.org',args.limit)}")


if __name__ == "__main__":
    main()
