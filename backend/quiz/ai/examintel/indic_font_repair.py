"""
examintel - Indic Font & Legacy Devanagari Glyph Repair Engine
==============================================================
Normalizes legacy non-Unicode embedded font glyph encodings commonly found in
state government exam response sheets (e.g. UP Police SI 2021, KrutiDev custom glyphs).
Converts corrupted glyph fragments (e.g. 'शÍद', 'संȲध', 'ȱव¼छेद', '·या')
into pristine standard Unicode Devanagari.
"""

from __future__ import annotations
import re
from typing import Dict, List, Optional

# Whole-word high-frequency vocabulary mapping
KNOWN_CORRUPTED_WORDS: Dict[str, str] = {
    "शÍद": "शब्द",
    "शÍदों": "शब्दों",
    "संȲध": "संधि",
    "ȱव¼छेद": "विच्छेद",
    "·या": "क्या",
    "·यों": "क्यों",
    "ȉंजन": "व्यंजन",
    "Éवȱन": "ध्वनि",
    "उ¼चारण-×थान": "उच्चारण-स्थान",
    "उ¼चारण": "उच्चारण",
    "×थान": "स्थान",
    "×थानों": "स्थानों",
    "मूधµÊय": "मूर्धन्य",
    "तालȉ": "तालव्य",
    "दÊÆय": "दन्त्य",
    "ओÖǯ": "ओष्ठ्य",
    "कÎÝय": "कण्ठ्य",
    "जगȃाथ": "जगन्नाथ",
    "×वर": "स्वर",
    "ȱवसगµ": "विसर्ग",
    "नहƭ": "नहीं",
    "हƭ": "हीं",
    "मƶ": "में",
    "हɇ": "हैं",
    "हʅ": "हूँ",
    "ȱकया": "किया",
    "ȱकसी": "किसी",
    "ȱकस": "किस",
    "ȱजस": "जिस",
    "ȱजसे": "जिसे",
    "ȱजतना": "जितना",
    "ȱवशेष": "विशेष",
    "ȱवधान": "विधान",
    "संȱवधान": "संविधान",
    "अȱधकार": "अधिकार",
    "अȱधकारी": "अधिकारी",
    "अȱधȱनयम": "अधिनियम",
    "पुȱलस": "पुलिस",
    "पǐरवार": "परिवार",
    "पǐरवतµन": "परिवर्तन",
    "उᱫर": "उत्तर",
    "पʉȱत": "पद्धति",
    "संपȄ": "संपन्न",
    "आȯा": "आज्ञा",
    "ȱवǻान": "विद्वान",
    "महÏव": "महत्व",
    "तÏव": "तत्व",
    "सिÏय": "सत्य",
    "असिÏय": "असत्य",
    "कÏतµȉ": "कर्तव्य",
    "धमµ": "धर्म",
    "कमµ": "कर्म",
    "वगµ": "वर्ग",
    "वणµ": "वर्ण",
    "पूणµ": "पूर्ण",
    "सवµ": "सर्व",
    "सवµनाम": "सर्वनाम",
    "साȱहÏय": "साहित्य",
    "कȱव": "कवि",
    "कȱवता": "कविता",
    "पȱत्रका": "पत्रिका",
    "पȊ": "पत्र",
    "¾यादा": "ज्यादा",
    "¾योतिर्मय": "ज्योतिर्मय",
    "ĒÕ": "प्रश्न",
    "ĒकाÕय": "प्रकाश्य",
    "Ēेमरा¾य": "प्रेमराज्य",
    "आवÕयकता": "आवश्यकता",
    "उǿेÕय": "उद्देश्य",
    "तीÛण": "तीक्ष्ण",
    "लÛय": "लक्ष्य",
    "स्वास्Çय": "स्वास्थ्य",
    "मु¸य": "मुख्य",
    "सुर³ा": "सुरक्षा",
    "पुȮÒलंग": "पुल्लिंग",
    "उȮÒलȶखत": "उल्लिखित",
    "बÒलेबाजी": "बल्लेबाजी",
    "बȮÒक": "बल्कि",
    "मूÒय": "मूल्य",
    "मूÒयवगǄ": "मूल्यवर्ग",
    "बाÒयावस्था": "बाल्यावस्था",
    "विकÒप": "विकल्प",
    "ȵवकÒप": "विकल्प",
    "अÒपसं¸यक": "अल्पसंख्यक",
    "अÒपसं¸यकǂ": "अल्पसंख्यकों",
    "कृȱčम": "कृत्रिम",
    "गिरÌतारी": "गिरफ्तारी",
    "नेÌयू": "नेप्च्यून",
    "Ìयूचर्स": "फ्यूचर्स",
    "घȲड़याँ": "घड़ियाँ",
    "चþवृȵǽ": "चक्रवृद्धि",
    "बिþɡ": "बिक्री",
    "बेȱēक": "बेफिक्र",
    "ȅुत्þमित": "व्युत्क्रमित",
    "ȱĔक्स": "ब्रिक्स",
    "अÐयर": "अधियर",
    "ȱčभुज": "त्रिभुज",
    "ȱþया": "क्रिया",
    "ȱþयाएं": "क्रियाएं",
    "ȱč¾या": "त्रिज्या",
    "सȱþय": "सक्रिय",
    "ȱǼवेदɟ": "द्विवेदी",
    "ȱþकेटर": "क्रिकेटर",
    "पयाµयवाची": "पर्यायवाची",
    "पयाµय": "पर्याय",
    "आशीवाµद": "आशीर्वाद",
    "आȳशवाµद": "आशीर्वाद",
    "दɟघायुµ": "दीर्घायु",
    "दɣघाµयु": "दीर्घायु",
    "सËताह": "सप्ताह",
    "समाËत": "समाप्त",
    "ĒाËत": "प्राप्त",
    "रा¾य": "राज्य",
    "रा¾यपाल": "राज्यपाल",
    "रा¾यसभा": "राज्यसभा",
    "कज़µन": "कर्ज़न",
    "निधाµȯरत": "निर्धारित",
    "पुनवाµस": "पुनर्वास",
    "पुनस्थाµपन": "पुनर्स्थापन",
    "वणाµनुþम": "वर्णानुक्रम",
    "शोधकताµǓ": "शोधकर्ताओं",
    "दशाµता": "दर्शाता",
    "दशाµती": "दर्शाती",
    "दशाµया": "दर्शाया",
    "ȵनवाµचन": "निर्वाचन",
    "ȳसफ़µ": "सिर्फ",
}

# Sub-glyph substitution rules (half letters, conjuncts, matras)
SUB_GLYPH_REPLACEMENTS: List[tuple[str, str]] = [
    # Compound letters
    ("¼छ", "च्छ"),
    ("¼च", "च्च"),
    ("¼", "\u091a\u094d"),     # च्
    ("Í", "\u092c\u094d"),     # ब्
    ("·", "\u0915\u094d"),     # क्
    ("É", "\u0927\u094d"),     # ध्
    ("Ê", "\u0928\u094d"),     # न्
    ("Æ", "\u0924\u094d"),     # त्
    ("Î", "\u0923\u094d"),     # ण्
    ("Ý", "ठ"),
    ("Ö", "ष्ठ"),
    ("ǯ", "्य"),
    ("ȉ", "व्य"),
    ("ȃ", "न्न"),
    ("ƶ", "में"),
    ("ᱫ", "त्त"),
    ("ʉ", "द्ध"),
    ("Ȅ", "न्न"),
    ("ǻ", "द्व"),
    ("Ï", "\u0924\u094d"),     # त्
    ("Ȋ", "त्र"),
    ("ɑ", "प्त"),
    ("ƭ", "ीं"),
    ("ɇ", "ैं"),
    ("ʅ", "ूँ"),
    ("þ", "क्र"),
    ("¾", "ज्य"),
    ("Ë", "प्"),
    ("Õ", "श्"),
    ("Ç", "थ्"),
    ("¸", "ख्"),
    ("³", "क्षा"),
    ("č", "त्र"),
    ("Ǽ", "द्व"),
    ("Û", "क्ष्"),
    ("Ì", "फ़्"),
    ("Ò", "ल्ल"),
    ("Ĕ", "ब्र"),
    ("ē", "फ़"),
    ("ȵ", "ति"),
    ("ȶ", "लि"),
    ("Ȯ", "ल"),
    ("ȯ", "रि"),
    ("ȳ", "सि"),
    ("ɟ", "ी"),
    ("ɣ", "ी"),
    ("Ǆ", "र्ग"),
    ("ǐ", "\u093f"),
    ("ǣ", "क्ति"),
    ("ȅ", "व्य"),
    ("Ɲ", "ष्ट"),
    ("Ƥ", "दू"),
    ("Ơ", "दू"),
    ("ɥ", "की"),
    ("ɡ", "की"),
    ("Ǘ", "ओं"),
    ("ǂ", "ों"),
    ("Ǔ", "ों"),
    ("Ē", "प्र"),
    ("¿", "द्ध"),
    ("À", "क्त"),
    ("Á", "ष्ठ"),
    ("Â", "त्र"),
    ("Ã", "श्र"),
    ("Ä", "क्ष"),
    ("Å", "ज्ञ"),
]

# Regex detecting any corrupted legacy glyphs in text
CORRUPTED_INDIC_REGEX = re.compile(
    r"[ȱȲ¼Í·ÉȃƶÖǯÊÆµÎÝᱫʉȄǻÏȊɑɇʅǐƭþ¾ËÕÇ¸³čǼÛÌÒĔēȵȶȮȯȳɟɣǄǣȅƝƤƠɥɡǗǂǓĒ¿ÀÁÂÃÄÅ]"
)


def has_corrupted_indic_glyphs(text: str) -> bool:
    """
    Returns True if the text contains non-standard Latin/Cyrillic extended
    glyphs commonly resulting from legacy Devanagari font extraction.
    """
    if not text:
        return False
    return bool(CORRUPTED_INDIC_REGEX.search(text))


def repair_math_glyphs(text: str) -> str:
    """
    Normalizes common mathematical font encoding substitutions in PDF text streams:
    - Corrupted multiplication glyph 'स्' in equations (e.g. '4515 स् 5' -> '4515 × 5', '‘स्’' -> '‘×’')
    - Corrupted Greek theta 'q' in trigonometric equations (e.g. 'cosec q' -> 'cosec θ', 'sec2q' -> 'sec² θ')
    - Squaring powers separated by space (e.g. 'cos 2 29°' -> 'cos² 29°')
    """
    if not text:
        return ""

    repaired = text

    # 1. Multiplication operator 'स्' in operator quotes: ‘स्’ -> ‘×’
    repaired = re.sub(r"([‘'\"“`´])स्([’'\"”`´])", r"\1×\2", repaired)

    # 2. Arithmetic equation context: digit/variable/bracket स् digit/variable/bracket or leading operator
    repaired = re.sub(r"(\d+|[A-Za-z\?\)]|\))\s*स्\s*(\d+|[A-Za-z\(]|\()", r"\1 × \2", repaired)
    repaired = re.sub(r"(^|[\s\+\-\—\–\=])स्\s*([\(A-Za-z0-9])", r"\1× \2", repaired)

    # 3. Trigonometric angles and powers: cosecq -> cosec θ, sec2q -> sec² θ, cot2q -> cot² θ, etc.
    def _trig_replace(m: re.Match) -> str:
        func = m.group(1)
        pwr = m.group(2)
        pwr_str = ""
        if pwr == "2":
            pwr_str = "²"
        elif pwr == "3":
            pwr_str = "³"
        elif pwr:
            pwr_str = f"^{pwr}"
        return f"{func}{pwr_str} θ"

    repaired = re.sub(r"\b(sin|cos|tan|cosec|sec|cot)\s*(\d+)?\s*q\b", _trig_replace, repaired, flags=re.IGNORECASE)

    # 4. Trigonometric powers separated by space: cos 2 29° -> cos² 29°
    repaired = re.sub(r"\b(sin|cos|tan|cosec|sec|cot)\s+2\s+(\d+°)", r"\1² \2", repaired, flags=re.IGNORECASE)

    return repaired


def repair_indic_text(text: str) -> str:
    """
    Normalizes legacy font encodings in Devanagari text to standard Unicode,
    and repairs font-glitched mathematical operators and symbols.
    Applies whole-word substitutions followed by sub-glyph ligature transformations
    and Chhoti 'I' / Reph transpositions.
    """
    if not text:
        return ""

    # Always normalize math glyph glitches first
    repaired = repair_math_glyphs(text)

    if not CORRUPTED_INDIC_REGEX.search(repaired):
        return repaired

    # Step 1: Whole-word substitutions
    for bad_w, good_w in sorted(KNOWN_CORRUPTED_WORDS.items(), key=lambda x: len(x[0]), reverse=True):
        if bad_w in repaired:
            repaired = repaired.replace(bad_w, good_w)

    # Step 2: Reph (र्) with following vowel or matra: e.g. दशाµता -> दर्शाता, वाµ -> र्वा, फ़µ -> र्फ
    repaired = re.sub(r'([क-हA-Za-z\u0900-\u097F])([ा-ौ]?)µ', 'र्\\1\\2', repaired)
    repaired = repaired.replace('µ', 'र्')

    # Step 3: Preceding Chhoti 'I' matra transposition:
    # Handles both raw glyphs and devanagari consonants
    repaired = re.sub(r'[Ȳȱǐ]([क-हA-Za-z\u0900-\u097Fþ¾ËÕÇ¸³čǼÛÌÒĔē])', '\\1ि', repaired)
    repaired = re.sub(
        r"([Ȳȱǐ])((?:[\u0904-\u0939]\u094d)*[\u0904-\u0939])",
        lambda m: m.group(2) + "ि",
        repaired,
    )

    # Step 4: Sub-glyph replacements
    for bad_g, good_g in SUB_GLYPH_REPLACEMENTS:
        if bad_g in repaired:
            repaired = repaired.replace(bad_g, good_g)

    # Contextual legacy half-sa conversion: '×' followed directly by a Devanagari consonant
    repaired = re.sub(r"×(?=[\u0904-\u0939])", "\u0938\u094d", repaired)

    # Step 5: Clean up intra-word matra spacing artifacts (consonant + space + matra within a word)
    dev_matras = r"[\u093e-\u094c\u0901-\u0903\u094d]"
    repaired = re.sub(rf"([\u0904-\u0939])\s+({dev_matras})", r"\1\2", repaired)

    # Re-normalize any math glyph glitches that may have been touched
    repaired = repair_math_glyphs(repaired)

    return repaired
