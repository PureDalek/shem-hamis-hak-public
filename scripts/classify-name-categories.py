"""Classify every catalog name from the reviewed meanings, with an audit trail.

Themes describe possible name meanings or origins, not the person bearing a name.
Unknown meanings stay explicitly unclassified; population groups never set themes.
"""
import argparse
import collections
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "data/research/name-categories"
OUTPUT = ROOT / "src/data/name-categories.json"
DEFINITIONS = [
    ("nature", "טבע"), ("biblical", "תנ״ך ומקורות"),
    ("mythology", "מיתולוגיה"), ("international", "לועזי / בינלאומי"),
    ("light", "אור ושמיים"), ("joy", "שמחה ואהבה"),
    ("strength", "כוח והגנה"), ("faith", "אמונה והודיה"),
    ("precious", "מתנות ואוצרות"), ("places", "מקומות"),
    ("virtues", "תכונות וערכים"), ("arts", "מוזיקה וצבעים"),
    ("life", "חיים ומשפחה"), ("other", "משמעויות נוספות"),
    ("unclassified", "עדיין ללא סיווג"),
]
# Explicit meanings only: neither source qualifications nor surnames are scanned.
TERMS = {
    "nature": "עץ עצים יער אילן אלון אורן ארז ברוש תמר דקל שקד זית פרח פרחים שושן שושנה ורד לילך נורית אשחר גומא דולב פטל רותם ערבה צבעוני סחלב שיח צמח נצר ניצן קיסוס גפן ענב גפן אריה לביאה אייל איילה צבי צבייה עופר יעל ציפור עוף דבורה יונה כבשה שה טלה זאב נץ נשר סוס דוב שועל שור פרה דג שמש ירח כוכב כוכבים שחר זריחה אור מאור הילה זוהר זיו טל ים נהר נחל גלים גל מים גשם שלג רוח ענן ברק רעם אופק אביב סתיו אדמה ארץ שדה הר גבעה עמק אבן אלמוג פנינה ענבר אופל יהלום זהב פז כסף ספיר ברקת רובי אודם טופז אקווה",
    "light": "אור מאור מאיר מאירה זוהר זוהרה זיו בהיר בהירה בוהק זורח זורחת זורחים זורחות זרח זריחה מאירים מפיצה מפיץ הילה נר שמש ירח כוכב כוכבים שחר שמים שמיים שמימית שמימי רינה",
    "joy": "שמחה שמח שמחים שמחות שמחה שמחות ישמח תשמח שמחת אושר מאושר מאושרת רינה רון נעימות נעים נעימה נועם אהבה אהוב אהובה אהובים אהובות אהבתי אהובתי חביב חביבה חביבות מתוק מתוקה מתיקות מחייך מחייכת שירה שיר זמרה לחן מנגינה מנגינות",
    "strength": "כוח עוצמה חזק חזקה חוזק אומץ אמיץ אמיצה גבורה גיבור גיבורה מגן הגנה שומר שמר הגן מגן משען מחסה מוגן ניצחון ניצחונות מנצח מנצחת כובש שליט שלטון מלך מלכה מלכות מלכותי מלכותית גבר גברי בריא בריאה איתן איתנה עוז יראה מלחמה",
    "faith": "אל האל אלי לאל אלוהים אלוהי אלוהות אדון קדוש קדושה קדושים אדוקה אדוק יראת אמונה הודאה הודיה תודה תפילה ברכה הלל שבח ישועה גאולה מרים",
    "precious": "מתנה מתנת מתנות שי מתן נתן נתינה נתינה זהב פז פנינה פנינים ענבר יהלום אודם רובי ברקת ספיר טופז אופל אבן אבנים אוצר מטמון עושר עשיר שפע יקר יקרה יקרת יקרות",
    "places": "עיר מחוז כפר נמל ירושלים ציון ארץ הר גבעה עמק נהר לוקניה אירלנד איראן ביירות יפו רומא סיני כנרת בשן הדריה מצרים גולן הדריה",
    "virtues": "חן חסד חוכמה חכמה חכם חכמה חכמים חכמות אמת אמיתי אמיתית ישר ישרה צדק צודק צודקת הוגן הוגנת טהור טהורה טוהר תמים תמימה שלם שלמה שלמות אציל אצילה אצילות אדיב אדיבה נדיב נדיבה נדיבות ענווה צנוע צנועה שקט שקטה רוגע שלווה שליו שלום עדין עדינה עדינות רך רכה רכות סבלנות יפה יופי נאה נבונה חופשי חופשית תקווה",
}
TERMS["light"] = " ".join(w for w in TERMS["light"].split() if w not in ["רינה", "מפיצה", "מפיץ"])
TERMS["faith"] = " ".join(w for w in TERMS["faith"].split() if w != "מרים") + " נס ניסים ברית גאולה דבקות"
TERMS["precious"] = " ".join(w for w in TERMS["precious"].split() if w not in ["אבן", "אבנים"]) + " תכשיט עדי רביד עיטור עטרה עטרת כתר שנהב משי"
TERMS["places"] = " ".join(w for w in TERMS["places"].split() if w not in ["ארץ", "סיני", "ציון"]) + " יבשת רכס מדינה שומרון שרון גליל"
TERMS["nature"] += " טבע נוף גדי עז גור אריות חוטר ענף ענפים גפן גפנים כרם מטע תבואה דגן תנובה יבול צמיחה פריחה נוב צוף שרף עצים שיחים סלע צוק הרים רכס אריות אנטילופה בקר אדמה קרקע שדה אש שלהבת להבה שלכת חורף קיץ מעיין לילה מים עננים זורם זורמים מושקה רווה רעננות"
TERMS["joy"] += " חיבה קירבה בשורות נחמה עידוד נעים מענג חברות חבר ידיד רעות ידידות סיפוק"
TERMS["strength"] += " חוסן בריאות תומך עזרה תמיכה סיוע מעולה נעלה רוממות נישא גבוה גדול עצום מנהיג מבצר"
TERMS["virtues"] += " הבנה תבונה יכולת צניעות פשטות ענוה טוב מיטיבה מובחר טוהר זכות פגם משפט דין שיפוט תקוה ייחול קיווה"
TERMS["arts"] = "מנגינה מנגינות מוזיקה נגינה זמרה שירה שיר זמר מיתר צליל קול גוון צבע צבעים ארגמן תכלת לובן לבן כחול סגול אדום אמנות"
TERMS["life"] = "אב אבי אבא אמא בן בת אח אחות ילד ילדה משפחה צאצא עמי חיים חי חיה חיי חיוניות תינוק לידה התחדשות דור"
LANGUAGES = "יוונית לטינית גרמאנית גרמנית אנגלית צרפתית רוסית סלאבית יידיש טורקית ערבית פרסית סנסקריט אירית קלטית וולשית גאלית נורדית ספרדית איטלקית פורטוגזית ברטונית אכדית מצרית פיניקי פיניקית שפות אירופה שפות סלאביות סינית רומאנית".split(" ")
LANGUAGES = [x for x in LANGUAGES if x not in ["שפות", "אירופה"]] + ["שפות אירופה", "שפות סלאביות", "סוואהילי", "מצרית עתיקה", "לטיני", "יווני", "גרמאני", "הוואית", "ערבי", "סקנדינבית", "אירופי", "אירופית"]
MYTHOLOGY = ["מיתולוגיה", "מיתולוגי", "אלה רומית", "אלה יוונית", "אלת", "מרס", "מרדוך", "אשתר", "ארטמיס", "ארטמיס", "ארטמיס", "אפולו", "אפרודיטה", "אתנה", "יופיטר", "אריאדנה", "פרווטי", "סלנה"]

# Names and established forms appearing in biblical/rabbinic traditions. This
# list is separate from word roots: a Hebrew dictionary lemma is not enough.
BIBLICAL = """
אברהם אברם אביגיל אביה אביהו אביגדור אביחי אבינועם אביעד אבישג אבישי אביתר אבנר
אהוד אהרן אהרון אדם אדוניה אדניה אלדד אליה אליהו אליעזר אליענה אליעם אליקים
אלימלך אלישע אלישבע אלקנה אסא אסף אסנת אסתר אפרים אראל אריאל ארם
איתן איתי איילון אילון איתם אלעזר אלעד אמוץ אמנון אמרי בועז בנימין בניה בנייה בניהו
בנציון בצלאל ברוך ברכיה ברוריה בתיה ביתיה בת שבע גבריאל גד גדעון גדליה גדליהו
גולן גמליאל דבורה דביר דויד דוד דינה דן דניאל דניאלה דותן הדס הדסה הלל הלליה
הושע הושעיה הראל חוה חווה חבקוק חגי חזקיה חזקיהו חנוך חנניה חננאל חנה חיים
טוביה טוביהו יאיר יגאל ידידיה ידידיהו יהודה יהודית יהונתן יהושע יהוסף יהורם יהויכין
יהוידע יהושפט יואב יואחז יואל יוחאי יוחנן יוכבד יונה יונתן יוסף יחזקאל יחיאל ינון ינאי
יעל יעקב יפתח יצחק ירובעם ירוחם ירמיה ירמיהו ישי ישראל ישכר יששכר ישעיה ישעיהו
ישמעאל איתמר יותם יותם יאשיהו כלב כרמל כנרת לוי לאה לביא ליבנה מלכה מילכה
מלאכי מנחם מנשה מרדכי מרים משה משולם מתן מתניה מתניהו מתתיהו נח נחום
נחמיה נחמן נחשון נועה נועם נעמי נפתלי נתן נתנאל נתניהו סיני סלא סלה עובד עובדיה
עוזי עוזיאל עמרם עמוס עמרי עידו עדו עזרא עלי עמינדב עמיאל עמיחי
עמינח עמיעד עמישב עמישדי ענר עפרה עקיבא עקיבה פנחס פלטיאל פנינה ציון ציונה
ציפורה צפורה צילה צור צורי רבקה רחל רחמים רות רותי ראובן רפאל שאול שובאל
שילה שילו שלמה שלומי שלומית שלומציון שלום שמואל שמחה שמריהו שמעון
שמשון שרה שרגא שרית תהילה תובל תמר תרצה
""".split()


def clean(value):
    return re.sub(r"[\u0591-\u05c7]", "", value or "")


def matches(text, words):
    hits = []
    for word in dict.fromkeys(words):
        # Whole words with Hebrew prepositions; never substrings in spellings.
        if re.search(r"(?<![א-ת])(?:ו?[בכל]?ה?|מה|שה|שב)?" + re.escape(word) + r"(?![א-ת])", text):
            hits.append(word)
    return hits


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    catalog = json.loads((ROOT / "src/data/catalog.json").read_text(encoding="utf-8"))["names"]
    editorial = json.loads((ROOT / "src/data/editorial.json").read_text(encoding="utf-8"))
    overrides_path = RESEARCH / "overrides.json"
    overrides = json.loads(overrides_path.read_text(encoding="utf-8")) if overrides_path.exists() else {}
    assert set(overrides) <= {n["name"] for n in catalog}, "Unknown override spelling"
    allowed = {id for id, _ in DEFINITIONS}
    assert all(set(v.get("add", []) + v.get("remove", [])) <= allowed and v.get("reason") for v in overrides.values()), "Invalid category override"
    records, assignments = [], {}
    for base in catalog:
        record = {**base, **editorial.get(base["id"], {})}
        meaning, origin = clean(record.get("meaning")), clean(record.get("origin"))
        reasons = {}
        for category, terms in TERMS.items():
            scanned = re.sub(r"אב(?:ן|ני) חן", "", meaning) if category == "virtues" else meaning
            scanned = re.sub(r"שם חיבה", "", scanned) if category == "joy" else scanned
            hits = matches(scanned, terms.split())
            if hits:
                reasons[category] = {"kind": "meaning", "matched": hits}
        if re.search(r"אב(?:ן|ני) חן", meaning):
            reasons["precious"] = {"kind": "meaning", "matched": ["אבן חן"]}
        if record["name"] in BIBLICAL or "עברית מקראית" in origin:
            reasons["biblical"] = {"kind": "named_tradition", "matched": [record["name"]]}
        foreign = [language for language in LANGUAGES if language in origin]
        if foreign:
            reasons["international"] = {"kind": "origin", "matched": foreign}
        myth = matches(meaning, MYTHOLOGY)
        if myth:
            reasons["mythology"] = {"kind": "meaning", "matched": list(dict.fromkeys(myth))}
        if re.search(r"ה[׳']", meaning):
            reasons.setdefault("faith", {"kind": "meaning", "matched": ["שם האל"]})
        # Explicit editorial review may remove homographs or classify a known
        # name without asserting a previously unknown etymology.
        change = overrides.get(base["name"], {})
        for category in change.get("remove", []):
            reasons.pop(category, None)
        for category in change.get("add", []):
            reasons[category] = {"kind": "editorial_review", "matched": [change["reason"]]}
        tags = [id for id, _ in DEFINITIONS if id in reasons]
        if not tags:
            fallback = "other" if meaning else "unclassified"
            tags = [fallback]
            reasons = {fallback: {"kind": "no_matching_theme" if meaning else "insufficient_evidence", "matched": []}}
        assignments[base["name"]] = tags
        records.append({"id": base["id"], "name": base["name"], "tags": tags, "basis": reasons,
            "meaning": record.get("meaning", ""), "origin": record.get("origin", ""),
            "sourceUrls": list(dict.fromkeys([r["url"] for r in record.get("meaningReferences", [])] + ([record["meaningSource"]] if record.get("meaningSource") else []) + change.get("sources", [])))})
    assert len(records) == len(assignments) == 2431
    summary = {"catalogNames": len(records), "categorized": sum(r["tags"] != ["unclassified"] for r in records),
        "counts": dict(collections.Counter(t for r in records for t in r["tags"])),
        "policy": "Themes reflect reviewed words, possible meanings or origins, never inferred religion or ethnicity. Multiple themes may apply. Unknown cases remain unclassified."}
    RESEARCH.mkdir(parents=True, exist_ok=True)
    for filename, data in [("review.json", records), ("summary.json", summary)]:
        (RESEARCH / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (RESEARCH / "review.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["מזהה", "שם", "קטגוריות", "בסיס לסיווג", "פירוש", "קישורי מקור"])
        for row in records:
            writer.writerow([row["id"], row["name"], " | ".join(dict(DEFINITIONS)[t] for t in row["tags"]),
                json.dumps(row["basis"], ensure_ascii=False), row["meaning"], "; ".join(row["sourceUrls"])])
    if args.publish:
        OUTPUT.write_text(json.dumps({"categories": [{"id": id, "label": label} for id, label in DEFINITIONS], "names": assignments}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
