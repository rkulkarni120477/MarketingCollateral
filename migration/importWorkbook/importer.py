"""Dry-run import logic: workbook cells in, canonical records and reconciliation out.

Nothing here writes to SharePoint. Hidden legacy rows and protected notes are
counted and matched, but their text is never copied into the returned model.
"""
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from .text import clean_text, name_key, parse_date, parse_statistic
from .workbook import load_exclusions, read_workbook

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config" / "mappings"
HEADER_DATE = re.compile(r"(\d{1,2} [A-Za-z]{3} \d{4})")
FILE_EXT = re.compile(r"\.([A-Za-z0-9]{2,5})$")
CONFLICT_550 = re.compile(r"\b550\b")
HOME_COUNT_ROWS = {2: "Presentations", 3: "One-Pagers", 4: "Brochures", 5: "Case Studies", 6: "Marketing Videos"}
CLIENT_COLUMNS = {"B": "K12", "C": "HE", "D": "WD"}


def load_config():
    domain = json.loads((CONFIG_DIR / "domain-mappings.json").read_text(encoding="utf-8"))
    status = json.loads((CONFIG_DIR / "status-rules.json").read_text(encoding="utf-8"))
    cats = json.loads((CONFIG_DIR / "category-sheets.json").read_text(encoding="utf-8"))
    exclusions = load_exclusions(CONFIG_DIR / "workbook-exclusions.json")
    return domain, status, cats, exclusions


def normalise_domains(raw, domain_cfg):
    """Return (domains, flags). Multi-domain records keep each domain once; literal AD/ALL is flagged."""
    key = clean_text(raw)
    if key is None:
        return [], ["DomainMissing"]
    mapping = domain_cfg["mappings"]
    matched = mapping.get(key)
    if matched is None:
        matched = next((v for k, v in mapping.items() if k.lower() == key.lower()), None)
    if matched is None:
        return [], ["DomainUnmapped"]
    flags = ["AllDomainsPendingConfirmation"] if key.upper() in domain_cfg["literalAllDomainsRawValues"] else []
    return list(dict.fromkeys(matched)), flags


def normalise_status(raw, status_cfg):
    """Keep the raw value separately. Blank becomes Not specified with NeedsStatusReview."""
    text = clean_text(raw)
    if text is None:
        return status_cfg["blankRawStatus"], [status_cfg["blankRawFlag"]]
    for life in status_cfg["lifecycle"]:
        if text.lower() == life.lower():
            return life, []
    return "Unrecognised", ["UnrecognisedStatus"]


def stable_id(category, title, occurrence):
    """Identity from category and normalised title, so reruns and row shifts do not duplicate records."""
    basis = f"{category}|{name_key(title) or 'untitled'}|{occurrence}"
    return "CAT-" + hashlib.sha1(basis.encode("utf-8")).hexdigest()[:12]


def extension_of(*candidates):
    for text in candidates:
        cleaned = clean_text(text)
        if cleaned:
            match = FILE_EXT.search(cleaned)
            if match:
                return match.group(1).lower()
    return "unknown"


def availability(link):
    """Availability is unverified at dry run: a reference exists but the file is not checked."""
    if link is None:
        return "missing"
    if link["kind"] in ("relative-unresolved", "unc-unresolved"):
        return "unresolved"
    return "reference-present-unverified"


def cell_at(sheet, coord):
    return sheet["cells"].get(coord)


def build_category(sheets, spec, domain_cfg, status_cfg, category):
    sheet = sheets[spec["sheet"]]
    cols = spec["columns"]
    records, source_rows, excluded_coords = [], 0, []
    seen = Counter()
    for row in range(2, sheet["max_row"] + 1):
        cells = {field: cell_at(sheet, f"{col}{row}") for field, col in cols.items()}
        excluded_coords += [c.coord for c in cells.values() if c is not None and c.excluded]
        if not any(c is not None and c.text is not None for c in cells.values()):
            continue
        source_rows += 1
        title_cell = cells["title"]
        if title_cell is None or title_cell.text is None:
            continue
        title = title_cell.text
        key = name_key(title)
        occurrence = seen[key]
        seen[key] += 1

        domains, domain_flags = normalise_domains(cells["domain"].value if cells.get("domain") else None, domain_cfg)
        status_cell = cells.get("status")
        status_raw = status_cell.text if status_cell is not None and status_cell.text is not None else ""
        status, status_flags = normalise_status(status_raw, status_cfg)

        source_cell = cells.get("source")
        source_link = source_cell.link if source_cell is not None and source_cell.link else None
        if spec.get("titleLinkIsSource") and source_link is None and title_cell.link:
            source_link = title_cell.link
        published_cell = cells.get("published")
        published_link = published_cell.link if published_cell is not None and published_cell.link else None

        flags = domain_flags + status_flags
        if source_link is None:
            flags.append("MissingSourceReference")
        elif source_link["kind"] in ("relative-unresolved", "unc-unresolved"):
            flags.append("UnresolvedSourceLink")
        if published_link is None:
            flags.append("MissingPublishedReference")
        if status == "Published" and published_link is None:
            flags.append("PublishedWithoutPublishedFile")
        if cells.get("reviewComments") and cells["reviewComments"].text:
            flags.append("ProtectedReviewNotePresent")
        if "reviewedBy" in cols and (cells.get("reviewedBy") is None or cells["reviewedBy"].text is None):
            flags.append("ReviewerNotRecorded")

        updated_by = cells["lastUpdatedBy"].text if cells.get("lastUpdatedBy") else None
        flags.append("OwnerIdentityUnresolved" if updated_by else "OwnerNotRecorded")
        iso, date_kind = parse_date(cells["lastUpdated"].value if cells.get("lastUpdated") else None)
        if date_kind == "unparsed":
            flags.append("UnparsedUpdateDate")

        records.append({
            "id": stable_id(category, title, occurrence),
            "category": category,
            "source": {"sheet": spec["sheet"], "row": title_cell.coord[1:], "titleCell": title_cell.coord},
            "title": title,
            "titleLink": title_cell.link,
            "newName": cells["newName"].text if cells.get("newName") else None,
            "currentDir": cells["currentDir"].text if cells.get("currentDir") else None,
            "currentDirLink": cells["currentDir"].link if cells.get("currentDir") else None,
            "domainRaw": clean_text(cells["domain"].value) if cells.get("domain") else None,
            "domains": domains,
            "description": cells["description"].text if cells.get("description") else None,
            "durationOrSlides": cells["durationOrSlides"].text if cells.get("durationOrSlides") else None,
            "versionLabel": cells["version"].text if cells.get("version") else None,
            "statusRaw": status_raw,
            "status": status,
            "sourceRef": source_link,
            "publishedRef": published_link,
            "fileAvailability": {"source": availability(source_link), "published": availability(published_link)},
            "fileTypeHint": extension_of(source_cell.text if source_cell and source_cell.text else None, title),
            "lastUpdated": iso,
            "lastUpdatedKind": date_kind,
            "lastUpdatedBy": updated_by,
            "reviewer": cells["reviewedBy"].text if cells.get("reviewedBy") else None,
            "legacyPuneetRetained": cells["legacyPuneet"].text if cells.get("legacyPuneet") else None,
            "flags": flags,
        })
    return {"records": records, "sourceRows": source_rows, "excludedCells": excluded_coords}


def build_statistics(sheets):
    """Recalculate the FTE total and role percentages from eligible components.

    Scope mirrors the workbook: eligible components are rows 3-10 of F/G, i.e. SUM(G3:G10).
    Rows 11-12 sit outside that total and their approval is TBD.
    """
    sheet = sheets["Logos_Stats"]
    approver_recorded = bool(clean_text(cell_at(sheet, "H2").value)) if cell_at(sheet, "H2") else False
    components = []
    for row in range(3, 11):
        label = cell_at(sheet, f"F{row}")
        if label is None or label.text is None:
            continue
        fte_cell = cell_at(sheet, f"G{row}")
        value = fte_cell.value if fte_cell is not None else None
        numeric = isinstance(value, (int, float)) and not isinstance(value, bool)
        components.append({
            "row": row,
            "label": label.text,
            "fte": value if numeric else None,
            "numeric": numeric,
            # ASSUMPTION: the header approver in Logos_Stats!H2 covers the FTE block (rows 3-10). Confirm with owner.
            "approval": "Approved per header name (scope assumed; identity unresolved)" if approver_recorded else "Unknown",
        })
    total = sum(c["fte"] for c in components if c["numeric"])
    for comp in components:
        comp["percentOfTotal"] = comp["fte"] / total if comp["numeric"] and total else None

    outside = []
    for row in (11, 12):
        label = cell_at(sheet, f"F{row}")
        fte_cell = cell_at(sheet, f"G{row}")
        approval_cell = cell_at(sheet, f"H{row}")
        outside.append({
            "row": row,
            "label": label.text if label else None,
            "fte": fte_cell.value if fte_cell else None,
            "inTotal": False,
            "approval": "Unapproved (TBD)" if approval_cell and approval_cell.text == "TBD" else "Unknown",
        })

    formula_total = cell_at(sheet, "G2")
    header_cell = cell_at(sheet, "D1")
    header_date = None
    if header_cell and header_cell.text:
        found = HEADER_DATE.search(header_cell.text)
        header_date = parse_date(found.group(1))[0] if found else None

    qualified = []
    for row in range(13, 20):
        label = cell_at(sheet, f"F{row}")
        if label is None or label.text is None:
            continue
        value_cell = cell_at(sheet, f"G{row}")
        date_cell = cell_at(sheet, f"I{row}")
        qualified.append({
            "row": row,
            "label": label.text,
            "value": parse_statistic(value_cell.value if value_cell else None),
            "effectiveDate": parse_date(date_cell.value)[0] if date_cell else None,
            "approval": "Unknown",
        })

    stat_dates = sorted({q["effectiveDate"] for q in qualified if q["effectiveDate"]})
    flags = []
    if header_date and stat_dates and header_date not in stat_dates:
        flags.append("HeaderDateMismatchStatisticDate")
    cached_ok = formula_total is not None and formula_total.formula is not None and formula_total.cached == total
    return {
        "fteComponents": components,
        "fteTotal": total,
        "formulaCachedTotal": formula_total.cached if formula_total and formula_total.formula else None,
        "fteTotalMatchesCachedFormula": cached_ok,
        "outsideTotal": outside,
        "headerDate": header_date,
        "qualifiedStatistics": qualified,
        "flags": flags,
    }


def build_clients(sheets):
    sheet = sheets["Logos_Stats"]
    names = []
    for col, domain in CLIENT_COLUMNS.items():
        for row in range(3, 48):
            cell = cell_at(sheet, f"{col}{row}")
            if cell is None or cell.text is None:
                continue
            names.append({"domain": domain, "name": cell.text, "key": name_key(cell.text), "row": row, "column": col})
    per_domain = Counter(n["domain"] for n in names)
    domains_by_key = defaultdict(set)
    for n in names:
        domains_by_key[n["key"]].add(n["domain"])
    return {
        "clients": names,
        "countsByDomain": {d: per_domain.get(d, 0) for d in CLIENT_COLUMNS.values()},
        "totalEntries": len(names),
        "distinctClients": len(domains_by_key),
        "multiDomainClients": sorted(k for k, v in domains_by_key.items() if len(v) > 1),
    }


def match_hidden(sheets, catalogue):
    """Propose candidate matches between hidden legacy rows and visible items. Candidates only; never applied."""
    pres_by_title, pres_by_new = defaultdict(list), defaultdict(list)
    for r in catalogue["Presentations"]:
        pres_by_title[name_key(r["title"])].append(r["id"])
        if r["newName"]:
            pres_by_new[name_key(r["newName"])].append(r["id"])
    one_by_title = defaultdict(list)
    for r in catalogue["One-Pagers"]:
        one_by_title[name_key(r["title"])].append(r["id"])

    results = {"Sheet1": Counter(), "02-OnePager-Catalogue_001": Counter()}
    protected = Counter()
    conflicts = []

    s1 = sheets["Sheet1"]
    notes_only_rows = 0
    for row in range(2, s1["max_row"] + 1):
        name = cell_at(s1, f"B{row}")
        new_name = cell_at(s1, f"D{row}")
        name_text = name.text if name is not None else None
        new_text = new_name.text if new_name is not None else None
        populated = any(cell_at(s1, f"{col}{row}") is not None and cell_at(s1, f"{col}{row}").text is not None
                        for col in "ABCDEFGHIJ")
        if not populated:
            continue
        if name_text is None and new_text is None:
            notes_only_rows += 1
            results["Sheet1"]["notes-only (no name)"] += 1
        else:
            ids = set(pres_by_title.get(name_key(name_text), [])) if name_text else set()
            ids |= set(pres_by_new.get(name_key(new_text), [])) if new_text else set()
            results["Sheet1"]["candidate-unique" if len(ids) == 1 else ("ambiguous" if ids else "unmatched")] += 1
        for col, label in (("F", "logoInstruction"), ("G", "internalBdmComment"), ("H", "updateNote")):
            cell = cell_at(s1, f"{col}{row}")
            if cell is not None and cell.text is not None:
                protected[label] += 1
    for coord, cell in s1["cells"].items():
        if cell.text is not None and CONFLICT_550.search(cell.text):
            conflicts.append({"sheet": "Sheet1", "cell": coord, "claim": "550 (conflicts with 700 FTE total)"})

    s2 = sheets["02-OnePager-Catalogue_001"]
    for row in range(2, s2["max_row"] + 1):
        name = cell_at(s2, f"A{row}")
        if name is None or name.text is None:
            continue
        ids = set(one_by_title.get(name_key(name.text), []))
        results["02-OnePager-Catalogue_001"]["candidate-unique" if len(ids) == 1 else ("ambiguous" if ids else "unmatched")] += 1
        for col, label in (("E", "legacyVersionNote"), ("J", "legacyOwnerNote"), ("B", "legacyNameMapping")):
            cell = cell_at(s2, f"{col}{row}")
            if cell is not None and cell.text is not None:
                protected[label] += 1
    for coord, cell in s2["cells"].items():
        if cell.text is not None and CONFLICT_550.search(cell.text):
            conflicts.append({"sheet": "02-OnePager-Catalogue_001", "cell": coord, "claim": "550 (conflicts with 700 FTE total)"})

    return {
        "results": {k: dict(v) for k, v in results.items()},
        "protectedNoteCounts": dict(protected),
        "conflicts550": conflicts,
        "notesOnlyRows": notes_only_rows,
    }


def run_dry_run(workbook_path):
    domain_cfg, status_cfg, cat_cfg, exclusions = load_config()
    sheets, before, after = read_workbook(workbook_path, exclusions)

    catalogue, category_reports = {}, {}
    for category, spec in cat_cfg["categories"].items():
        built = build_category(sheets, spec, domain_cfg, status_cfg, category)
        catalogue[category] = built["records"]
        category_reports[category] = {
            "sourceRows": built["sourceRows"],
            "records": len(built["records"]),
            "excludedCells": built["excludedCells"],
            "statusCounts": dict(Counter(r["status"] for r in built["records"])),
        }

    home = sheets["Home"]["cells"]
    home_checks = {}
    for row, category in HOME_COUNT_ROWS.items():
        cell = home.get(f"C{row}")
        home_checks[category] = {
            "homeFormulaCached": cell.cached if cell and cell.formula else None,
            "importedRecords": len(catalogue[category]),
        }
    home_checks["Rate Cards"] = {
        "homeFormulaCached": None,
        "importedRecords": len(catalogue["Rate Cards"]),
        "note": "No count formula in Home for Rate Cards",
    }

    link_counts = Counter()
    for sheet_name, sheet in sheets.items():
        for cell in sheet["cells"].values():
            if cell.link:
                link_counts[f"{sheet_name}|{cell.link['kind']}"] += 1

    flags = Counter(f for rs in catalogue.values() for r in rs for f in r["flags"])
    clients = build_clients(sheets)
    return {
        "homeContent": {
            "purpose": home.get("B15").text if home.get("B15") else None,
            "showcaseLink": home.get("B17").link if home.get("B17") else None,
        },
        "workbook": {
            "fileName": Path(workbook_path).name,
            "sha256Before": before,
            "sha256After": after,
            "sourceUnchanged": before == after,
            "sheets": {n: {"state": s["state"], "maxRow": s["max_row"]} for n, s in sheets.items()},
        },
        "exclusions": [
            {"sheet": s, "cell": c.coord, "reason": c.excluded}
            for s, sh in sheets.items() for c in sh["cells"].values() if c.excluded
        ],
        "categories": category_reports,
        "totalVisibleRecords": sum(len(v) for v in catalogue.values()),
        "homeCrossCheck": home_checks,
        "flagCounts": dict(flags),
        "linkCounts": dict(sorted(link_counts.items())),
        "statistics": build_statistics(sheets),
        "clients": {k: v for k, v in clients.items() if k != "clients"},
        "hiddenEvidence": match_hidden(sheets, catalogue),
        "catalogue": catalogue,
        "clientRecords": clients["clients"],
    }
