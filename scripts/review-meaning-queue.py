"""Read stable review queue with concise source excerpts; never approves data."""
import argparse
import importlib.util
import re

spec = importlib.util.spec_from_file_location("full", __file__.replace("review-meaning-queue.py", "full-name-research.py"))
full = importlib.util.module_from_spec(spec)
spec.loader.exec_module(full)
parser = argparse.ArgumentParser()
parser.add_argument("start", type=int)
parser.add_argument("stop", type=int)
parser.add_argument("--limit", type=int, default=600)
args = parser.parse_args()
caches = {lang: full.cache(f"{lang}.wiktionary.org") for lang in ("he", "en")}
queue = full.read(full.DIR / "evidence-queue.json")
for i, row in enumerate(queue, 1):
    if not args.start <= i <= args.stop:
        continue
    print(f"\n{i} {row['name']} {','.join(row['groups'])}")
    for source in row['sources']:
        lang, title = source.split(":", 1)
        page = caches[lang][title]
        if lang == "he":
            lines = [line for line in page.get("wikitext", "").splitlines()
                     if re.match(r"^==[^=]|^#(?![:*])", line)]
            excerpt = " / ".join(lines)[:args.limit]
        else:
            excerpt = full.compact(page, "en.wiktionary.org", args.limit)
        print(f"{source}: {excerpt}")
