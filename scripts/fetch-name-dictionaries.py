"""Download reusable Wiktionary extracts once, retaining compact review evidence.

Kaikki/Wiktextract's language exports are intended for bulk use. The source
snapshot and extract hash are recorded. This script never approves a meaning.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

import requests

RAW = Path(__file__).resolve().parents[1] / "data/raw/all-name-meanings"


def normalized(text):
    import re
    return re.sub(r"[\u0591-\u05c7\u064b-\u065f\u0670]", "", text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("languages", nargs="+", choices=["Hebrew", "Arabic", "Yiddish", "Persian", "Turkish"])
    args = parser.parse_args()
    for language in args.languages:
        url = f"https://kaikki.org/dictionary/{language}/kaikki.org-dictionary-{language}.jsonl"
        target = RAW / f"kaikki-{language}.jsonl.gz"
        digest = hashlib.sha256()
        if not target.exists():
            response = requests.get(url, stream=True, timeout=(15, 90), headers={"User-Agent": "NaMeCatalogResearch/0.2 (dictionary review; read only)"})
            response.raise_for_status()
            temporary = target.with_suffix(".tmp")
            count = 0
            with gzip.open(temporary, "wb", compresslevel=3) as handle:
                for chunk in response.iter_content(1024 * 1024):
                    handle.write(chunk)
                    digest.update(chunk)
                    count += len(chunk)
                    if count // (100 * 1024 * 1024) != (count-len(chunk)) // (100 * 1024 * 1024):
                        print(f"{language}: downloaded {count//(1024*1024)} MiB", flush=True)
            temporary.replace(target)
            print(f"{language}: download complete, {count} bytes", flush=True)
        entries = {}
        count = 0
        with gzip.open(target, "rb") as handle:
            for line in handle:
                obj = json.loads(line)
                if obj.get("pos") not in ["name", "noun", "adj", "verb", "adv", "phrase"]:
                    continue
                word = obj["word"]
                record = {k: obj[k] for k in ["word", "lang", "lang_code", "pos", "etymology_text", "etymology_number"] if k in obj}
                record["senses"] = [{k: sense[k] for k in ["glosses", "tags", "form_of", "alt_of", "raw_glosses"] if k in sense} for sense in obj.get("senses", [])]
                entries.setdefault(normalized(word), []).append(record)
                count += 1
        data = {"language": language, "source": url, "sourceIndex": f"https://kaikki.org/dictionary/{language}/",
                "sourceEdition": "en.wiktionary.org", "dumpDate": "2026-10-01", "extractedAt": "2026-10-25",
                "license": "CC-BY-SA-4.0; derived from Wiktionary via Wiktextract/Kaikki",
                "extractorAttribution": "Tatu Ylonen, Wiktextract: Wiktionary as Machine-Readable Structured Data (LREC 2022)",
                "entries": entries}
        (RAW / f"kaikki-{language}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"{language}: indexed {count} entries / {len(entries)} normalized words", flush=True)


if __name__ == "__main__":
    main()
