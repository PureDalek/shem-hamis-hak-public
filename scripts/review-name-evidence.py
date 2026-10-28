"""Print compact dictionary evidence for manual semantic review of the pilot."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "data/research/name-meanings-200"
sample = json.loads((root / "sample.json").read_text(encoding="utf-8"))
mapping = json.loads((root / "lookup-map.json").read_text(encoding="utf-8"))["en.wiktionary.org"]
cache = json.loads((root.parents[1] / "raw/name-meanings-200/en-wiktionary-org.json").read_text(encoding="utf-8"))["pages"]
start = int(sys.argv[1]) if len(sys.argv) > 1 else 1
stop = int(sys.argv[2]) if len(sys.argv) > 2 else 200
for index, record in enumerate(sample["records"], 1):
    if not start <= index <= stop:
        continue
    print(f"\n### {index}. {record['name']}")
    for title in mapping[record["name"]]:
        page = cache.get(title)
        if page is None or page.get("missing"):
            continue
        parts = re.split(r"(?m)^==([^=\n]+)==\s*$", page.get("wikitext", ""))
        for j in range(1, len(parts), 2):
            language, content = parts[j].strip(), parts[j + 1]
            if re.search(r"[\u0600-\u06ff]", title):
                allowed = ["Arabic", "Persian"]
            elif re.search(r"[\u0590-\u05ff]", title):
                allowed = ["Hebrew", "Yiddish", "Aramaic"]
            else:
                allowed = ["English", "Turkish", "French", "Italian", "Latin", "Greek"]
            if language not in allowed:
                continue
            etymologies = re.findall(r"(?ms)^={3,}Etymology[^\n]*\n(.*?)(?=^===|\Z)", content)
            definitions = re.findall(r"(?m)^# (.+)$", content)
            text = "ETY " + " / ".join(t.strip() for t in etymologies)[:500] + "\nDEF " + " / ".join(definitions)[:500]
            print(f"{title} [{language}] {text}")
            break
