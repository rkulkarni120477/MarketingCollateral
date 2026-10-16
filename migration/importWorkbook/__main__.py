"""Command line entry point.

    python -m migration.importWorkbook --workbook <path> [--json <file>] [--markdown <file>] [--fixture <file>]

Dry run is the only mode. There is no apply mode in this build: SharePoint writes
need explicit deployment approval and a tenant, so they are not implemented here.
"""
import argparse
import sys
from pathlib import Path

from .importer import run_dry_run
from .reports import write_fixture, write_json_model, write_markdown


def main(argv=None):
    parser = argparse.ArgumentParser(description="Dry-run import of the Marketing Collateral workbook.")
    parser.add_argument("--workbook", required=True, type=Path, help="Path to the source .xlsx (opened read-only).")
    parser.add_argument("--json", type=Path, help="Write the full model here. Keep under a gitignored folder.")
    parser.add_argument("--markdown", type=Path, help="Write the reconciliation report (counts only).")
    parser.add_argument("--fixture", type=Path, help="Write the sanitized local preview fixture.")
    parser.add_argument("--apply", action="store_true", help="Refused: SharePoint apply needs deployment approval.")
    args = parser.parse_args(argv)

    if args.apply:
        print("Refused: --apply is not available. Live import requires explicit deployment approval.", file=sys.stderr)
        return 2
    if not args.workbook.is_file():
        print(f"Workbook not found: {args.workbook}", file=sys.stderr)
        return 1

    model = run_dry_run(args.workbook)
    if args.json:
        write_json_model(model, args.json)
    if args.markdown:
        write_markdown(model, args.markdown)
    if args.fixture:
        write_fixture(model, args.fixture)

    print(f"Source unchanged: {model['workbook']['sourceUnchanged']}")
    print(f"Total visible records: {model['totalVisibleRecords']}")
    for category, rep in model["categories"].items():
        print(f"  {category}: source rows {rep['sourceRows']}, records {rep['records']}")
    stats = model["statistics"]
    print(f"FTE total: {stats['fteTotal']} (matches cached formula: {stats['fteTotalMatchesCachedFormula']})")
    print(f"Clients: {model['clients']['countsByDomain']} total {model['clients']['totalEntries']}")
    print(f"Exclusions recorded: {len(model['exclusions'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
