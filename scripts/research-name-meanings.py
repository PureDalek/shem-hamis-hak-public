"""Fetch dictionary evidence for the fixed random pilot; never publish automatically.

Uses Wikimedia's public read API in small sequential batches. The response cache
and attempt log distinguish missing entries from transport failures. Run with
UTF-8 output (PYTHONIOENCODING=utf-8 on Windows).
"""
import argparse
import datetime as dt
import json
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
PILOT = ROOT / "data/research/name-meanings-200"
CACHE = ROOT / "data/raw/name-meanings-200"


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def fetch(site, titles, label):
    target = CACHE / f"{label}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        result = json.loads(target.read_text(encoding="utf-8"))
    else:
        result = {"site": site, "license": "CC-BY-SA-4.0", "pages": {}, "requests": []}
    pending = [t for t in dict.fromkeys(titles) if t not in result["pages"] or
               (not result["pages"][t].get("missing") and "wikitext" not in result["pages"][t])]
    session = requests.Session()
    session.headers["User-Agent"] = "NaMeMeaningPilot/0.1 (dictionary evidence research; read only)"
    for offset in range(0, len(pending), 10):
        batch = pending[offset:offset + 10]
        started = time.perf_counter()
        attempt = {"at": now(), "titles": batch}
        try:
            response = session.get(f"https://{site}/w/api.php", params={
                "action": "query", "format": "json", "formatversion": 2,
                "titles": "|".join(batch), "prop": "revisions", "redirects": 1,
                "rvprop": "ids|timestamp|content", "rvslots": "main",
            }, timeout=45)
            response.raise_for_status()
            data = response.json()
            if "error" in data:
                raise ValueError(str(data["error"]))
            query = data["query"]
            pages = {p["title"]: p for p in query["pages"]}
            aliases = {p["from"]: p["to"] for p in query.get("normalized", []) + query.get("redirects", [])}
            for original in batch:
                title = original
                seen = set()
                while title in aliases and title not in seen:
                    seen.add(title)
                    title = aliases[title]
                page = pages.get(title)
                if page is not None:
                    for revision in page.get("revisions", []):
                        page["wikitext"] = revision.pop("slots", {}).get("main", {}).get("content", "")
                    result["pages"][original] = {**page, "requestedTitle": original, "retrievedAt": now()}
            attempt["status"] = "ok"
        except (requests.RequestException, ValueError, KeyError) as error:
            attempt.update(status="error", error=str(error))
        attempt["seconds"] = round(time.perf_counter() - started, 3)
        result["requests"].append(attempt)
        target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{label}: {min(offset + 10, len(pending))}/{len(pending)} {attempt['status']}", flush=True)
        if attempt["status"] == "error" and "429" in attempt.get("error", ""):
            break
        time.sleep(1.2)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["exact", "mapped"])
    args = parser.parse_args()
    sample = json.loads((PILOT / "sample.json").read_text(encoding="utf-8"))
    if args.mode == "exact":
        titles = [r["name"] for r in sample["records"]]
        fetch("he.wiktionary.org", titles, "he-wiktionary-exact")
    else:
        mapping = json.loads((PILOT / "lookup-map.json").read_text(encoding="utf-8"))
        for site, entries in mapping.items():
            fetch(site, [title for titles in entries.values() for title in titles], site.replace(".", "-"))


if __name__ == "__main__":
    main()
