import datetime as dt

from migration.importWorkbook.text import clean_text, name_key, parse_date, parse_statistic
from migration.importWorkbook.workbook import classify_link
from migration.importWorkbook.importer import normalise_domains, normalise_status, stable_id, load_config


def test_clean_text_removes_zero_width_and_collapses_whitespace():
    assert clean_text("Academian Capabilities\nOverview​") == "Academian Capabilities Overview"
    assert clean_text("  Flex ​ ") == "Flex"


def test_clean_text_blank_returns_none():
    assert clean_text(None) is None
    assert clean_text("​   ") is None


def test_name_key_ignores_extension_version_and_punctuation():
    assert name_key("Academian_Org_Charts.pptx") == name_key("Academian Org Charts")
    assert name_key("Academian - AI_OnePager_K-12_V1.0") == name_key("Academian AI OnePager K12")


def test_parse_date_native_serial_and_text():
    assert parse_date(dt.datetime(2026, 9, 1)) == ("2026-09-01", "native")
    assert parse_date(45658) == ("2025-01-01", "serial")  # Excel serial for 1 Jan 2025
    assert parse_date("24 Aug 2026") == ("2026-08-24", "text")
    assert parse_date(None) == (None, "blank")
    assert parse_date("not a date") == (None, "unparsed")


def test_qualified_statistics_are_not_converted_to_exact():
    flex = parse_statistic("500+")
    assert flex["number"] == 500 and flex["qualifier"] == "at least" and flex["exact"] is False
    daily = parse_statistic("5M+")
    assert daily["number"] == 5 and daily["unit"] == "M" and daily["qualifier"] == "at least"
    exact = parse_statistic(70)
    assert exact["exact"] is True and exact["qualifier"] is None


def test_blank_status_is_explicit_not_published():
    domain_cfg, status_cfg, _, _ = load_config()
    assert normalise_status(None, status_cfg) == ("Not specified", ["NeedsStatusReview"])
    assert normalise_status("Published", status_cfg) == ("Published", [])
    assert normalise_status("Under Revision", status_cfg) == ("Unrecognised", ["UnrecognisedStatus"])


def test_domain_mapping_keeps_multi_domain_and_flags_all_domains():
    domain_cfg, _, _, _ = load_config()
    assert normalise_domains("HE+WD", domain_cfg) == (["Higher Education", "Workforce Development"], [])
    assert normalise_domains("AD", domain_cfg) == (["All Domains"], ["AllDomainsPendingConfirmation"])
    assert normalise_domains("XYZ", domain_cfg) == ([], ["DomainUnmapped"])
    assert normalise_domains(None, domain_cfg) == ([], ["DomainMissing"])


def test_stable_id_depends_on_category_and_title_not_row():
    a = stable_id("Presentations", "Academian Org Charts.pptx", 0)
    b = stable_id("Presentations", "academian_org_charts", 0)
    assert a == b
    assert a != stable_id("One-Pagers", "Academian Org Charts.pptx", 0)
    assert a != stable_id("Presentations", "Academian Org Charts.pptx", 1)


def test_safelink_unwrapped_and_relative_links_not_guessed():
    safe = ("https://ind01.safelinks.protection.outlook.com/?url=https%3A%2F%2Facademian.com%2Fprojects-showcase%2F"
            "&data=05&reserved=0")
    assert classify_link(safe, None) == {"kind": "safelink-unwrapped", "raw": safe, "resolved": "https://academian.com/projects-showcase/"}
    rel = classify_link("Academian_Org decks/deck.pptx", None)
    assert rel["kind"] == "relative-unresolved" and rel["resolved"] is None
    assert classify_link(None, "'01-PresentationsCatalogue'!A1")["kind"] == "internal-sheet"
    assert classify_link("mailto:someone@example.com", None)["kind"] == "mailto"
