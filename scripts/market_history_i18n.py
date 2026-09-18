# -*- coding: utf-8 -*-
"""Add min/max price + price-history i18n keys to all 5 market blocks."""
import io, sys
sys.stdout.reconfigure(encoding='utf-8')

P = 'src/data/translations.js'
s = io.open(P, encoding='utf-8').read()

BLOCKS = {
    'en': (
        '            filterAll: "All", filterBasmati: "Basmati", filterTraditional: "Traditional", filterPremium: "Premium", filterOther: "Other",',
        '            minPrice: "Min Price", maxPrice: "Max Price", priceHistory: "Price History", range7d: "7 Days", range1m: "1 Month",',
    ),
    'bn': (
        '            filterAll: "সব", filterBasmati: "বাসমতী", filterTraditional: "ঐতিহ্যবাহী", filterPremium: "প্রিমিয়াম", filterOther: "অন্যান্য",',
        '            minPrice: "সর্বনিম্ন দাম", maxPrice: "সর্বোচ্চ দাম", priceHistory: "মূল্যের ইতিহাস", range7d: "৭ দিন", range1m: "১ মাস",',
    ),
    'hi': (
        '            filterAll: "सभी", filterBasmati: "बासमती", filterTraditional: "पारंपरिक", filterPremium: "प्रीमियम", filterOther: "अन्य",',
        '            minPrice: "न्यूनतम भाव", maxPrice: "अधिकतम भाव", priceHistory: "मूल्य इतिहास", range7d: "7 दिन", range1m: "1 महीने",',
    ),
    'te': (
        '            filterAll: "అన్నీ", filterBasmati: "బాస్మతి", filterTraditional: "సాంప్రదాయ", filterPremium: "ప్రీమియం", filterOther: "ఇతర",',
        '            minPrice: "కనిష్ట ధర", maxPrice: "గరిష్ఠ ధర", priceHistory: "ధర చరిత్ర", range7d: "7 రోజులు", range1m: "1 నెల",',
    ),
    'ta': (
        '            filterAll: "அனைத்தும்", filterBasmati: "பாஸ்மதி", filterTraditional: "பாரம்பரிய", filterPremium: "பிரீமியம்", filterOther: "மற்றவை",',
        '            minPrice: "குறைந்த விலை", maxPrice: "அதிகபட்ச விலை", priceHistory: "விலை வரலாறு", range7d: "7 நாட்கள்", range1m: "1 மாதம்",',
    ),
}

fails = []
for lang, (anchor, insert) in BLOCKS.items():
    n = s.count(anchor)
    if n != 1:
        fails.append(f'{lang}: anchor count = {n}')
        continue
    s = s.replace(anchor, anchor + '\n' + insert, 1)

if fails:
    print('FAILED:'); [print('  ' + f) for f in fails]; sys.exit(1)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('min/max/history keys added to all 5 blocks.')
