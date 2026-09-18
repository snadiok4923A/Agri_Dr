# -*- coding: utf-8 -*-
"""Add disease-search i18n keys to all 5 language blocks.

Anchors on each language's disease `empty:` line (unique per language via
its distinctive fragment) and inserts the new keys right after it.
"""
import io
import sys

sys.stdout.reconfigure(encoding="utf-8")

P = "src/data/translations.js"

BLOCKS = {
    "No diseases match": '''            searchPlaceholder: "Search disease or symptom...",
            searchHint: "Search by:",
            searchTerms: {
                leaf: "Leaf",
                spots: "Spots",
                yellow: "Yellow leaf",
                sheath: "Sheath",
                stem: "Stem",
            },
            resultCount: "{n} diseases found",
            noMatch: "No matching disease found",
            emptyHint: "Try searching by disease name or symptom.",''',
    "কোনো রোগ মেলেনি": '''            searchPlaceholder: "রোগ বা উপসর্গ খুঁজুন...",
            searchHint: "যা দিয়ে খুঁজতে পারেন:",
            searchTerms: {
                leaf: "পাতা",
                spots: "দাগ",
                yellow: "হলুদ পাতা",
                sheath: "শীথ",
                stem: "কাণ্ড",
            },
            resultCount: "{n}টি রোগ পাওয়া গেছে",
            noMatch: "কোনো মিল পাওয়া যায়নি",
            emptyHint: "রোগের নাম বা উপসর্গ লিখে খুঁজুন।",''',
    "कोई रोग नहीं मिला": '''            searchPlaceholder: "रोग या लक्षण खोजें...",
            searchHint: "इनसे खोजें:",
            searchTerms: {
                leaf: "पत्ती",
                spots: "धब्बे",
                yellow: "पीली पत्ती",
                sheath: "शीथ",
                stem: "तना",
            },
            resultCount: "{n} रोग मिले",
            noMatch: "कोई मेल खाता रोग नहीं मिला",
            emptyHint: "रोग के नाम या लक्षण से खोजें।",''',
    "తెగుళ్లు కనబడలేదు": '''            searchPlaceholder: "వ్యాధి లేదా లక్షణం వెతకండి...",
            searchHint: "వీటితో వెతకండి:",
            searchTerms: {
                leaf: "ఆకు",
                spots: "మచ్చలు",
                yellow: "పసుపు ఆకు",
                sheath: "షీత్",
                stem: "కాండం",
            },
            resultCount: "{n} వ్యాధులు కనబడ్డాయి",
            noMatch: "సరిపోయే వ్యాధి కనబడలేదు",
            emptyHint: "వ్యాధి పేరు లేదా లక్షణంతో వెతకండి.",''',
    "நோய்கள் இல்லை": '''            searchPlaceholder: "நோய் அல்லது அறிகுறியைத் தேடுங்கள்...",
            searchHint: "இவற்றால் தேடலாம்:",
            searchTerms: {
                leaf: "இலை",
                spots: "புள்ளிகள்",
                yellow: "மஞ்சள் இலை",
                sheath: "ஷீத்",
                stem: "தண்டு",
            },
            resultCount: "{n} நோய்கள் கண்டறியப்பட்டன",
            noMatch: "பொருந்தும் நோய் இல்லை",
            emptyHint: "நோய் பெயர் அல்லது அறிகுறியால் தேடுங்கள்.",''',
}

with io.open(P, encoding="utf-8") as f:
    lines = f.read().split("\n")

inserted = {k: 0 for k in BLOCKS}
out = []
for line in lines:
    out.append(line)
    stripped = line.strip()
    if stripped.startswith("empty:"):
        for frag, block in BLOCKS.items():
            if frag in line:
                out.append(block)
                inserted[frag] += 1
                break

with io.open(P, "w", encoding="utf-8", newline="") as f:
    f.write("\n".join(out))

ok = all(v == 1 for v in inserted.values())
print("INSERTS:", inserted)
print("OK" if ok else "MISMATCH — check duplicates/missing anchors")
