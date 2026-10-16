# Data decisions and assumptions

Written for: the solution owner (site owner), business owners of the collateral, and engineers. Each item states the decision, why, and its status. Items marked **Owner decision** block final configuration; the build proceeds on the stated assumption, which is configurable.

## Corrections to the brief (verified against the workbook)

| Brief said | Workbook shows | Consequence |
| --- | --- | --- |
| FTE total is `SUM(G3)` | `Logos_Stats!G2` is `=SUM(G3:G10)` (also `J2`) | Scope is rows 3-10, which gives 700. Implemented as the real formula range. |
| All one-pager cells with links have blank-looking values | Every one-pager hyperlink cell has a visible value (19 Source, 19 Published). No linked cell is blank-looking. | No blank-looking link cells exist to retain. The brief's example did not reproduce. |
| Hidden Sheet1 has 33 populated rows | 33 populated rows: 32 with a name plus 1 row containing notes only | Reconciled exactly. |
| Presentation domains (not stated) | AD 61, K12 2, WD 2, HE 1. No HE+WD values. | Implemented. The validation list also contains HE+WD. |
| Presentation Source and Published blank | Confirmed blank. Title hyperlinks (66) and Current Dir folder links (64) are the only links. | Title link is used as the source reference (see D-04). |
| Presentation statuses blank | Confirmed. 66 blank. | Shown as Not specified with NeedsStatusReview. |

## Decisions

| ID | Decision | Why | Status |
| --- | --- | --- | --- |
| D-01 | Visible catalogue values are the baseline (90 records). Hidden rows are held as restricted evidence, never records. | Brief requirement. Hidden rows are legacy names and notes. | Adopted |
| D-02 | Lifecycle values: Draft, In Review, Published, Archived. Blank becomes **Not specified** with NeedsStatusReview. Unknown values become Unrecognised. | Brief requirement. Blank must not become a publication claim. | Adopted |
| D-03 | **Under Revision** is an indicator, not a lifecycle value: In Review OR an open import review flag. Shown on the dashboard only. | Brief allows this if clearly defined and does not replace In Review. | **Owner decision** on the definition |
| D-04 | Presentation title hyperlinks are treated as the source file reference. Source (PPT) and Published (PDF) columns stay blank. | Titles are filename-style and all 66 carry a link. Without this, no presentation has a file. | **Owner decision** (assumption; confirm the title link opens the source deck) |
| D-05 | Published status does not imply file availability. Availability is a separate field: reference-present-unverified, missing, or unresolved. | Brief requirement. Verification needs tenant access. | Adopted |
| D-06 | Domain mapping (configurable in `config/mappings/domain-mappings.json`): K12 and K-12 to K-12; HE to Higher Education; WD to Workforce Development; HE+WD to both; AD and ALL to All Domains. | Brief proposal. | **Owner decision** for AD and ALL |
| D-07 | Multi-domain records count once in overall totals. Filters match a selected domain through the domain list. Literal All Domains records are flagged and kept distinct. | Prevents double counting. | Adopted |
| D-08 | Visible Review comments (66 values) are protected notes by default. They are not reader content until the owner classifies them. | Brief: editorial notes must be secured. The text can contain review decisions. | Adopted; **Owner decision** on which, if any, become reader-visible |
| D-09 | The Puneet column is kept as legacy text (one value: "Very old file"). Its meaning is not inferred. | Brief requirement. | Adopted |
| D-10 | Version is a source label, separate from SharePoint version history. Header comments say the column is the current published version. | Brief requirement. The comment supports the reading. | Adopted |
| D-11 | Source "Last Updated" and "Last Updated By" stay separate from SharePoint Created, Modified, Author and Editor. | Brief requirement. | Adopted |
| D-12 | Owners and reviewers are names until an authorised lookup resolves them. No email is guessed. Presentations have 4 editor names; one-pagers have 2 editors and one reviewer; brochures have none. | Brief requirement. | Adopted; identity lookup needs tenant access |
| D-13 | Statistic approval: the header approver in `Logos_Stats!H2` is assumed to cover the FTE block (rows 3-10). Rows 11-12 are TBD (unapproved). Rows 13-19 have no approval (Unknown). | The header is the only approval marker; its scope is an assumption. | **Owner decision** |
| D-14 | Header date (24 Aug 2026) and statistic dates (1 Sep 2026) are kept as found and flagged. No date is changed. | Brief requirement. | Adopted; **Owner decision** on which date governs |
| D-15 | Hidden 550 claims are flagged against the 700 FTE total at 7 cells (Sheet1 H6, H7, H16, H17, H19, H29 and J19). No claim is declared valid. | Brief requirement. | Adopted |
| D-16 | A client comment records "Added Sep 10, 2026" for BND (Axiom HE). That date is later than both the header and statistic dates. It is kept as provenance and flagged for review. | Dates do not agree. | Adopted; flagged |
| D-17 | Historical FTE comments (earlier counts on 4 Sep, Tech Developers changed 120 to 225 per an approver message) are restricted notes. They are not imported as approved figures. | Brief requirement. | Adopted |
| D-18 | Home showcase link is the SafeLinks-wrapped `academian.com/projects-showcase/`. The wrapper is removed; the destination is kept. | Brief: show the ordinary link without its credential. | Adopted |
| D-19 | Presentation source files sit on a personal OneDrive-for-Business host (`academian1-my`). Access follows the owner's OneDrive permissions, not the site's. | Important governance point. Copying files into managed libraries requires authorised access. | **Owner decision** before any file copy |
| D-20 | Relative folder links (64 Current Dir, 3 title links) are unresolved. The base is not known, so none is resolved. | Brief: never guess a base URL. | Adopted; **Owner decision** on the base or on re-linking |
| D-21 | Duplicate and retirement notes (hidden one-pager sheet, 32 rows, 0 title matches) are held for review. Nothing is merged, retired or deleted automatically. | Brief requirement. | Adopted |
| D-22 | Hidden evidence matching uses a normalised name key (lowercase, no extension, no version token, alphanumerics only). Matches are candidates only. Results: Sheet1 2 ambiguous, 30 unmatched, 1 notes-only; one-pager legacy sheet 32 unmatched. | Legacy names carry extensions and version suffixes. | Adopted |
| D-23 | Logo instructions in hidden sheets produce review tasks only. Client names and logo references are never deleted from an instruction. | Brief requirement. | Adopted |
| D-24 | "Accesibility Services" (row 11) is spelled as in the workbook. The corrected spelling is proposed for review, not applied. | Original spellings are provenance. | Proposed; **Owner decision** |

## Qualified statistics (kept as stated)

500+ (Flex), 30+ (Active Clients), 5+ (Locations), 200+ (Projects Delivered), 5M+ (Daily Learners), 13+ (Locations Staffing), 1000+ (Years of Combined Experience). Parsed into number, unit and qualifier ("at least"). Never converted to an exact figure.

## Open questions that block final configuration

1. Confirm AD and ALL both mean All Domains (D-06).
2. Confirm the title link is the source deck (D-04).
3. Define Under Revision (D-03).
4. Which approver and scope apply to the statistics (D-13)?
5. Which date governs the statistics: 24 Aug or 1 Sep 2026 (D-14)?
6. Are the presentation files to stay on the personal OneDrive host, or move to a managed library (D-19)?
7. Are review comments reader-visible or protected (D-08)?

None of these blocks the dry run. Each blocks the matching configuration or a live import.
