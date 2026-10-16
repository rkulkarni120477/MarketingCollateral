"""Reconciliation against the supplied workbook.

Runs only when the workbook is present (it is excluded from Git). Set
MARKETING_WORKBOOK to point elsewhere. Assertions are counts and flags only.
"""
import os
from pathlib import Path

import openpyxl
import pytest

from migration.importWorkbook.importer import run_dry_run

ROOT = Path(__file__).resolve().parents[2]
WORKBOOK = Path(os.environ.get("MARKETING_WORKBOOK", ROOT / "MarketingCollateral.xlsx"))

pytestmark = pytest.mark.skipif(not WORKBOOK.exists(), reason="supplied workbook not present")


@pytest.fixture(scope="module")
def model():
    return run_dry_run(WORKBOOK)


def test_source_workbook_unchanged(model):
    assert model["workbook"]["sourceUnchanged"] is True


def test_owner_reconciliation_counts(model):
    assert len(model["catalogue"]["Presentations"]) == 66
    assert len(model["catalogue"]["One-Pagers"]) == 22
    assert len(model["catalogue"]["Brochures"]) == 2
    for empty in ("Case Studies", "Marketing Videos", "Rate Cards"):
        assert len(model["catalogue"][empty]) == 0
    assert model["totalVisibleRecords"] == 90


def test_home_formulas_agree_with_import(model):
    for category in ("Presentations", "One-Pagers", "Brochures", "Case Studies", "Marketing Videos"):
        check = model["homeCrossCheck"][category]
        assert check["homeFormulaCached"] == check["importedRecords"], category


def test_home_purpose_and_showcase_link_are_preserved(model):
    assert model["homeContent"]["purpose"]
    assert model["homeContent"]["showcaseLink"]["kind"] == "safelink-unwrapped"
    assert model["homeContent"]["showcaseLink"]["resolved"] == "https://academian.com/projects-showcase/"


def test_all_presentation_statuses_are_explicit_not_specified(model):
    statuses = {r["status"] for r in model["catalogue"]["Presentations"]}
    assert statuses == {"Not specified"}
    assert all("NeedsStatusReview" in r["flags"] for r in model["catalogue"]["Presentations"])


def test_every_presentation_title_hyperlink_extracted(model):
    records = model["catalogue"]["Presentations"]
    assert all(r["titleLink"] is not None for r in records)
    # Three title links are relative, so they stay unresolved rather than guessed.
    assert sum(1 for r in records if r["titleLink"]["kind"] == "relative-unresolved") == 3
    assert sum(1 for r in records if r["titleLink"]["kind"] == "absolute") == 63
    # Current Dir folder links are preserved for all populated rows.
    assert sum(1 for r in records if r["currentDirLink"] is not None) == 64


def test_presentation_file_types_are_not_assumed_to_be_powerpoint(model):
    hints = {r["fileTypeHint"] for r in model["catalogue"]["Presentations"]}
    assert "pptx" in hints
    assert len(hints) > 1


def test_one_pager_links_and_published_claims(model):
    records = model["catalogue"]["One-Pagers"]
    assert sum(1 for r in records if r["sourceRef"]) == 19
    assert sum(1 for r in records if r["publishedRef"]) == 19
    published_without_file = [r for r in records if "PublishedWithoutPublishedFile" in r["flags"]]
    assert len(published_without_file) == 3


def test_client_counts_reconcile(model):
    clients = model["clients"]
    assert clients["countsByDomain"] == {"K12": 14, "HE": 9, "WD": 12}
    assert clients["totalEntries"] == 35


def test_fte_total_and_outside_scope(model):
    stats = model["statistics"]
    assert stats["fteTotal"] == 700
    assert stats["fteTotalMatchesCachedFormula"] is True
    assert [o["fte"] for o in stats["outsideTotal"]] == [50, 25]
    assert all(o["inTotal"] is False for o in stats["outsideTotal"])
    assert "HeaderDateMismatchStatisticDate" in stats["flags"]


def test_qualified_statistics_preserved(model):
    raws = [q["value"]["raw"] for q in model["statistics"]["qualifiedStatistics"]]
    assert raws == ["500+", "30+", "5+", "200+", "5M+", "13+", "1000+"]
    assert all(q["value"]["qualifier"] == "at least" for q in model["statistics"]["qualifiedStatistics"])


def test_only_the_credential_cell_is_excluded(model):
    assert model["exclusions"] == [{"sheet": "Home", "cell": "B18", "reason": "plaintext credential"}]


def test_hidden_rows_are_held_not_imported(model):
    results = model["hiddenEvidence"]["results"]
    legacy = results["Sheet1"]
    assert legacy["notes-only (no name)"] == 1
    assert sum(v for k, v in legacy.items() if k != "notes-only (no name)") == 32
    assert sum(results["02-OnePager-Catalogue_001"].values()) == 32
    assert model["totalVisibleRecords"] == 90


def test_conflicting_550_claims_are_flagged(model):
    assert len(model["hiddenEvidence"]["conflicts550"]) == 7


def test_credential_value_absent_from_model(model):
    """Read the excluded cell's value only inside the test to check it never reaches the model."""
    wb = openpyxl.load_workbook(WORKBOOK, read_only=True, data_only=False)
    secret = wb["Home"]["B18"].value
    wb.close()
    if not secret:
        pytest.skip("Home!B18 is empty in this workbook")
    import json
    assert str(secret) not in json.dumps(model, default=str)
