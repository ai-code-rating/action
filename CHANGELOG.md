# Changelog

## 2026-10-07: v1.0.0, First Release

- Checks `ACR.md` against AI Code Rating spec 0.1 with the same `ACR.md` checks as the validator at aicoderating.com/validate/, copied from the site repo by its `scripts/sync-action.mjs`. The Action also checks the README badge, below.
- Errors fail the check: a missing or invalid rating, spec version or date, and broken front matter. `updated` must be a real calendar date written as YYYY-MM-DD, and a rating with spaces around it, such as `" A2b"`, is an error, since the field holds just the three characters.
- Warnings, such as a rating last checked over a year ago, show as notes on the file and pass unless `fail-on-warnings` is `true`. A date one day ahead of the runner's date doesn't warn as "in the future", since the maintainer's local date can be ahead of UTC.
- The body check ignores HTML comments, and warns when there's no text after the front matter, when the body has only headings, or when a "How AI Was Used" section is empty, such as when the rating form's placeholder comment is left in.
- Warns when the ACR badge in the README shows a different rating from `ACR.md`, so a badge doesn't go stale when the rating changes. Works with Markdown, HTML and reStructuredText READMEs, and looks for the README where GitHub does (`.github/`, the root, then `docs/`). Badges keep loading from shields.io, so nothing depends on aicoderating.com.
- If `ACR.md` isn't found, a file whose name differs only in case (such as `acr.md`) is checked instead, as the spec says tools should. An empty or missing file is an error.
- Each result is an annotation on the right line, plus a summary table on the run page and the outputs `rating`, `errors` and `warnings`.
- No dependencies and no build step. 29 tests. Listed on the GitHub Marketplace as "AI Code Rating Check".
