"""Latin slugs for the events / venues / artists tables (the slug column is unique)."""
from __future__ import annotations

import re

# Official Ukrainian transliteration (Cabinet of Ministers resolution No. 55), simplified:
# no position-dependent rules.
_UK = {
    "а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "е": "e", "є": "ie",
    "ж": "zh", "з": "z", "и": "y", "і": "i", "ї": "i", "й": "i", "к": "k", "л": "l",
    "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch", "ь": "",
    "ю": "iu", "я": "ia", "ы": "y", "э": "e", "ё": "e", "ъ": "", "'": "", "’": "", "ʼ": "",
}


def slugify(text: str, max_len: int = 80) -> str:
    """'Курган і Agregat. 100% на ЗСУ' -> 'kurhan-i-agregat-100-na-zsu'."""
    s = "".join(_UK.get(ch, ch) for ch in text.lower())
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:max_len].rstrip("-") or "event"
