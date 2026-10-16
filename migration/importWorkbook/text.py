"""Text, date and number helpers for the workbook importer.

Source values are kept raw by callers. These helpers only produce cleaned
values for matching and display.
"""
import datetime as dt
import re
import unicodedata

ZERO_WIDTH = re.compile("[​‌‍⁠﻿]")
WHITESPACE = re.compile(r"\s+")
EXCEL_EPOCH = dt.datetime(1899, 12, 30)
FILE_EXTENSION = re.compile(r"\.(pptx?|pdf|docx?|xlsx?|mp4|mov|vtt|txt)$", re.IGNORECASE)
VERSION_TOKEN = re.compile(r"(?<![a-z])v\d+(?:\.\d+)*(?![a-z0-9])")
QUALIFIED_NUMBER = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s*(\+)?\s*$")


def clean_text(value):
    """Return whitespace-normalised text, or None when the cell is blank.

    Zero-width characters are removed and runs of whitespace (including
    newlines) collapse to one space. Used for matching and display only.
    """
    if value is None:
        return None
    text = unicodedata.normalize("NFKC", str(value))
    text = ZERO_WIDTH.sub("", text)
    text = WHITESPACE.sub(" ", text).strip()
    return text or None


def name_key(value):
    """Matching key for file-style names: lowercase, no extension, no version token, alphanumerics only.

    Used only to propose candidate matches between hidden legacy rows and visible
    catalogue items. A key match is never treated as an approved link.
    """
    text = clean_text(value)
    if text is None:
        return ""
    text = FILE_EXTENSION.sub("", text.lower())
    text = VERSION_TOKEN.sub(" ", text)
    return re.sub(r"[^a-z0-9]", "", text)


def parse_date(value):
    """Return (iso_date_or_None, kind) for native dates, Excel serials and common text dates.

    kind is one of: native, serial, text, blank, unparsed.
    """
    if value is None or (isinstance(value, str) and clean_text(value) is None):
        return None, "blank"
    if isinstance(value, dt.datetime):
        return value.date().isoformat(), "native"
    if isinstance(value, dt.date):
        return value.isoformat(), "native"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if 1 <= value < 100000:
            return (EXCEL_EPOCH + dt.timedelta(days=float(value))).date().isoformat(), "serial"
        return None, "unparsed"
    text = clean_text(value)
    for fmt in ("%d %b %Y", "%Y-%m-%d", "%d-%b-%y", "%d %B %Y"):
        try:
            return dt.datetime.strptime(text, fmt).date().isoformat(), "text"
        except ValueError:
            continue
    return None, "unparsed"


def parse_statistic(value):
    """Parse a company statistic into its number, unit and qualifier without converting it to exact.

    '500+' keeps qualifier 'at least'; '5M+' keeps unit 'M'. Plain numbers are exact.
    """
    if value is None or clean_text(value) is None:
        return {"raw": None, "number": None, "unit": None, "qualifier": None, "exact": False}
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return {"raw": value, "number": value, "unit": None, "qualifier": None, "exact": True}
    text = clean_text(value)
    match = QUALIFIED_NUMBER.match(text)
    if not match:
        return {"raw": value, "number": None, "unit": None, "qualifier": None, "exact": False}
    number = float(match.group(1))
    number = int(number) if number.is_integer() else number
    qualifier = "at least" if match.group(3) else None
    return {"raw": value, "number": number, "unit": match.group(2), "qualifier": qualifier, "exact": qualifier is None}
