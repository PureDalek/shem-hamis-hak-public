"""Format explicit manual selections; never select or approve by matching alone.

manual-approvals.json lists the source rows reviewed by the editor, plus wording
and reference corrections. Input hash prevents an edited candidate table from
silently changing earlier decisions. The output TSVs remain the publication input.
"""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "data/research/all-name-meanings"
FIELDS = ["names", "origin", "meaning", "sources", "note"]


def main():
    plan = json.loads((DIR / "manual-approvals.json").read_text(encoding="utf-8"))
    source = DIR / "alias-groups.tsv"
    assert hashlib.sha256(source.read_bytes()).hexdigest() == plan["candidateFileSha256"]
    with source.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))
    cohort = {r["name"] for r in json.loads((DIR / "manifest.json").read_text(encoding="utf-8"))["records"]}
    outputs = set(plan["batches"])
    done = set()
    for file in DIR.glob("reviewed*.tsv"):
        if file.name not in outputs:
            with file.open(encoding="utf-8") as handle:
                for r in csv.DictReader(handle, delimiter="\t"):
                    done.update(r["names"].split("|"))
    for output, batch in plan["batches"].items():
        assert output.startswith("reviewed-") and Path(output).name == output and output.endswith(".tsv")
        approved = []
        for index in batch["rows"]:
            r = rows[index-1]
            decision = {"names": r["names"], "origin": r["origin"], "meaning": r["candidate"],
                "sources": ";".join("e:"+t for t in r["titles"].split("|")),
                "note": "הפירוש מותנה בזיהוי עם הקריאה שבמקור. ערך מילוני אינו קובע את כוונת כל נושאי השם."}
            decision.update(batch.get("overrides", {}).get(str(index), {}))
            names = [n for n in dict.fromkeys(decision["names"].split("|")) if n in cohort and n not in done]
            if not names:
                continue
            decision["names"] = "|".join(names)
            done.update(names)
            approved.append(decision)
        with (DIR / output).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS, delimiter="\t", lineterminator="\n")
            writer.writeheader()
            writer.writerows(approved)
        print(f"{output}: {len(approved)} reviewed groups")


if __name__ == "__main__":
    main()
