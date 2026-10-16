"""Read-only access to the supplied workbook.

The source file is opened for reading only and its SHA-256 is taken before and
after reading so the importer can prove it did not modify the source. Excluded
cells are replaced by a marker before any value is copied, so excluded content
never reaches intermediate output.
"""
import dataclasses
import hashlib
import json
import re
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, unquote, urlsplit

import openpyxl

from .text import clean_text

# Heuristic guard: values that look like credentials are excluded even when not listed.
# Only the coordinate is reported; the matched text is never stored.
SECRET_HINT = re.compile(
    r"(password|passwd|pwd\s*[:=]|api[_ ]?key\s*[:=]|client[_ ]?secret|secret\s*[:=]|bearer\s+[A-Za-z0-9._-]{8,})",
    re.IGNORECASE,
)


@dataclasses.dataclass
class CellInfo:
    sheet: str
    coord: str
    value: object = None          # raw value as stored in the workbook (formula text for formulas)
    cached: object = None         # cached calculated value for formula cells
    formula: Optional[str] = None
    link: Optional[dict] = None   # {"kind", "raw", "resolved"}
    has_comment: bool = False     # presence only; comment text is never copied
    excluded: Optional[str] = None  # reason, when the cell is excluded

    @property
    def text(self):
        """Cleaned display text. Excluded cells always return None."""
        if self.excluded:
            return None
        return clean_text(self.cached if self.formula else self.value)


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 16), b""):
            digest.update(block)
    return digest.hexdigest()


def load_exclusions(config_path):
    data = json.loads(Path(config_path).read_text(encoding="utf-8"))
    return {(item["sheet"], item["cell"]): item["reason"] for item in data["exclusions"]}


def classify_link(target, location):
    """Classify a hyperlink without resolving relative paths.

    Relative targets keep their raw text and are marked unresolved: the base URL
    is not verified, so the importer never guesses it.
    """
    if location and not target:
        return {"kind": "internal-sheet", "raw": location, "resolved": location}
    if target is None:
        return {"kind": "none", "raw": None, "resolved": None}
    parts = urlsplit(target)
    if parts.scheme == "mailto":
        return {"kind": "mailto", "raw": target, "resolved": None}
    if "safelinks.protection.outlook.com" in parts.netloc:
        inner = parse_qs(parts.query).get("url", [None])[0]
        inner = unquote(inner) if inner else None
        return {"kind": "safelink-unwrapped", "raw": target, "resolved": inner}
    if parts.scheme in ("http", "https"):
        return {"kind": "absolute", "raw": target, "resolved": target}
    if target.startswith("\\\\"):
        return {"kind": "unc-unresolved", "raw": target, "resolved": None}
    return {"kind": "relative-unresolved", "raw": target, "resolved": None}


def read_workbook(path, exclusions):
    """Return (sheets, fingerprint_before, fingerprint_after).

    sheets is {name: {"state": str, "cells": {coord: CellInfo}, "max_row": int}}.
    """
    before = file_sha256(path)
    formulas_wb = openpyxl.load_workbook(path, data_only=False)
    values_wb = openpyxl.load_workbook(path, data_only=True)
    sheets = {}
    for ws in formulas_wb.worksheets:
        vs = values_wb[ws.title]
        cells = {}
        for row in ws.iter_rows():
            for cell in row:
                raw = cell.value
                if raw is None and cell.hyperlink is None and cell.comment is None:
                    continue
                info = CellInfo(sheet=ws.title, coord=cell.coordinate)
                reason = exclusions.get((ws.title, cell.coordinate))
                if reason is None and isinstance(raw, str) and SECRET_HINT.search(raw):
                    reason = "heuristic: secret-like text (value withheld)"
                if reason:
                    info.excluded = reason
                    cells[cell.coordinate] = info
                    continue
                if isinstance(raw, str) and raw.startswith("="):
                    info.formula = raw
                    info.cached = vs[cell.coordinate].value
                else:
                    info.value = raw
                if cell.hyperlink is not None:
                    info.link = classify_link(cell.hyperlink.target, cell.hyperlink.location)
                info.has_comment = cell.comment is not None
                cells[cell.coordinate] = info
        sheets[ws.title] = {"state": ws.sheet_state, "cells": cells, "max_row": ws.max_row}
    after = file_sha256(path)
    if before != after:
        raise RuntimeError("Source workbook changed during read; import aborted.")
    return sheets, before, after
