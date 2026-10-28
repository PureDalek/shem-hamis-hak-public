"""Apply manually reviewed, conditional interpretations and expose pilot sources.

No candidate is approved by a dictionary lookup. decisions.json contains the
human-reviewed wording; sources.json preserves attribution and revision metadata.
The user's CSV is a candidate list, never an etymological reference.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "data/research/meaning-evidence"
PILOT = ROOT / "data/research/name-meanings-200"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish", action="store_true", help="Merge the reviewed additions into editorial.json")
    parser.add_argument("--refresh-sources", action="store_true", help="Read revision metadata from the ignored dictionary caches")
    args = parser.parse_args()
    decisions = read(RESEARCH / "decisions.json")
    registry_path = RESEARCH / "sources.json"
    registry = read(registry_path) if registry_path.exists() else {}
    cache = {}
    if args.refresh_sources:
        for file in (ROOT / "data/raw/name-meanings-200").glob("*.json"):
            data = read(file)
            if isinstance(data, dict) and data.get("site"):
                for title, page in data.get("pages", {}).items():
                    if page.get("wikitext") and not page.get("missing"):
                        cache[(data["site"], title)] = page
    catalog = read(ROOT / "src/data/catalog.json")["names"]
    names = {name["name"]: name["id"] for name in catalog}
    editorial_path = ROOT / "src/data/editorial.json"
    editorial = read(editorial_path)
    pilot_sources = read(PILOT / "sources.json")
    migrated = 0
    for record in read(PILOT / "results.json")["records"]:
        if record["status"] != "meaning_found":
            continue
        target = editorial[record["id"]]
        if "meaningReferences" not in target:
            target["meaningReferences"] = [{
                "url": pilot_sources[key]["url"],
                "label": label(pilot_sources[key]["url"]),
            } for key in record["sources"]]
            target["meaningStatus"] = "possible"
        migrated += 1
    assert len({row["name"] for row in decisions["records"]}) == len(decisions["records"])
    for row in decisions["records"]:
        assert row["name"] in names, row["name"]
        assert row["meaningStatus"] in ("possible", "disputed", "documented")
        refs = []
        for spec, note in row["references"]:
            prefix, title = spec.split(":", 1)
            if prefix in ("e", "h"):
                site = {"e": "en.wiktionary.org", "h": "he.wiktionary.org"}[prefix]
                url = f"https://{site}/wiki/{quote(title.replace(' ', '_'))}"
                if args.refresh_sources:
                    page = cache[(site, title)]
                    revision = page["revisions"][0]
                    registry[url] = {
                        "url": url, "title": title, "publisher": site,
                        "revisionId": revision["revid"], "revisionAt": revision["timestamp"],
                        "retrievedAt": page["retrievedAt"], "license": "CC-BY-SA-4.0",
                        "attribution": f"Wiktionary contributors, {page['title']}, revision {revision['revid']}; Hebrew adaptation",
                        "revisionUrl": f"https://{site}/w/index.php?title={quote(page['title'])}&oldid={revision['revid']}",
                    }
            else:
                assert prefix == "u"
                url = title
                registry[url] = {
                    "url": url, "publisher": urlparse(url).hostname,
                    "reviewedAt": decisions["reviewedAt"],
                    "reviewMethod": "Page read; brief factual paraphrase. Linked for the specific claim in the reference note.",
                    "license": "No article redistribution rights asserted",
                }
            assert url in registry, f"Missing source metadata: {url}"
            assert urlparse(url).scheme == "https"
            refs.append({"url": url, "label": label(url), "note": note})
        assert refs
        changes = {key: row[key] for key in ("meaning", "origin", "meaningStatus", "meaningNote")}
        changes.update(meaningSource=refs[0]["url"], meaningReferences=refs)
        editorial.setdefault(names[row["name"]], {}).update(changes)
    write(registry_path, registry)
    summary = {
        "reviewedAt": decisions["reviewedAt"],
        "catalogCount": len(catalog), "meaningsAfter": sum(bool(v.get("meaning")) for v in editorial.values()),
        "pilotMeaningsWithEvidence": migrated,
        "additionalMeanings": len(decisions["records"]),
        "additionsFromCsvCandidates": [r["name"] for r in decisions["records"][:10]],
        "catalogSha256": hashlib.sha256((ROOT / "src/data/catalog.json").read_bytes()).hexdigest(),
        "sourceCountDefinition": "Distinct linked source pages per interpretation, not independent corroboration or certainty. Several pages can describe different links in one etymological chain.",
        "pilot": "The historical random sample and its original results are unchanged.",
    }
    write(RESEARCH / "summary.json", summary)
    if args.publish:
        write(editorial_path, editorial)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def label(url):
    parsed = urlparse(url)
    if parsed.hostname and parsed.hostname.endswith(".wiktionary.org"):
        language = "עברית" if parsed.hostname.startswith("he.") else "אנגלית"
        return f"ויקימילון ({language}) · {unquote(parsed.path.split('/wiki/')[-1])}"
    if parsed.hostname == "www.ahdictionary.com":
        return "American Heritage · Esther"
    if parsed.hostname == "wehe.hilo.hawaii.edu":
        return "מילוני אוניברסיטת הוואי · lani"
    return parsed.hostname or url


if __name__ == "__main__":
    main()
