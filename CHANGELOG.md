# Changelog

## 2026-11-02: v1.0.3, js-yaml 5.5.0

- Re-synced `lib/` from the site, which updated the YAML parser in `lib/js-yaml.cjs` from js-yaml 5.4.3 to 5.5.0. Only that file changed, and all tests pass.
- One stricter behaviour: an unquoted front matter key or value that starts with `,`, `]`, or `}` (such as `rating: ]B4b`) used to load as text and is now an error, "The front matter isn't valid YAML".

## 2026-10-12: Release Steps, No Release

- `CLAUDE.md`'s Releases section now lists the release steps after the commit is pushed: lightweight tags, pushing the new version tag, the force push that moves `v1` (which waits for Greg's go-ahead), and the GitHub release the Marketplace listing reads, with the changelog bullets as its notes. It also says an update to the bundled js-yaml is a new release. Docs only, so there's no new release.

## 2026-10-12: v1.0.2, js-yaml 5

- Re-synced `lib/` from the site, which updated the YAML parser in `lib/js-yaml.cjs` from js-yaml 4 to 5.4.3. Only that file changed. The parts the checks use (`load`, `CORE_SCHEMA`, which keeps dates as written, and the error's line number) work as before, and all tests pass.
- One stricter behaviour: a complex YAML key in the front matter, such as `? [a]`, used to be quietly turned into the field `a`, which passed with a note. It's now an error, "The front matter isn't valid YAML".
- Some YAML errors are worded differently. For example, an unclosed `[` now reports "deficient indentation" instead of "missed comma between flow collection entries", on the same line as before.

## 2026-10-12: Licence and CLAUDE.md, No Release

- Added the email address to the copyright line in `LICENSE`, so it reads `Copyright (c) 2026 Greg Chetcuti <greg@chetcuti.com>`.
- Filled gaps in `CLAUDE.md`: the shape of the results the checks return, how the test cases are laid out, how to run the Action by hand, and what `dependabot.yml` and `CHANGELOG.md` are for. It also says the Claude Code commit trailer is only for commits where Claude changed code. Docs only, so there's no new release.
- The README's usage example now uses `actions/checkout@v7`, the same version as the test workflow, so people who copy it get the current version.
- Moved the "try the Action by hand" paragraph in `CLAUDE.md` below the Files list, where it had split the list before the `ACR.md` bullet.

## 2026-10-12: Dependabot, No Release

- Added `.github/dependabot.yml` so Dependabot checks the actions used in `.github/workflows/test.yml` (`actions/checkout` and `actions/setup-node`) once a month and opens one grouped pull request when new versions are out. New releases wait 7 days before they're proposed. Security fixes come as their own pull requests and don't wait. Its updates only touch the repo's own test workflow, not the Action, so there's no new release.
- The test workflow now uses `actions/checkout@v7` and `actions/setup-node@v6` (both were `v5`), from Dependabot's first pull request (#1), made here instead of merged. Neither change affects this workflow: checkout v7 blocks checking out fork pull requests in `pull_request_target` and `workflow_run` workflows, which this one doesn't use. The tests pass, and so did the pull request's own run with the new versions.

## 2026-10-09: v1.0.1, Synced Wording

- Re-synced `lib/` from the site, which changed punctuation in the level descriptions, an example, and a comment in the checks. Wording only: no check, level, or result changes, and all tests pass.
- Punctuation fixes in the README and a comment in `index.cjs`.

## 2026-10-07: v1.0.0, First Release

- Checks `ACR.md` against AI Code Rating spec 0.1 with the same `ACR.md` checks as the validator at aicoderating.com/validate/, copied from the site repo by its `scripts/sync-action.mjs`. The Action also checks the README badge, below.
- Errors fail the check: a missing or invalid rating, spec version or date, and broken front matter. `updated` must be a real calendar date written as YYYY-MM-DD, and a rating with spaces around it, such as `" A2b"`, is an error, since the field holds just the three characters.
- Warnings, such as a rating last checked over a year ago, show as notes on the file and pass unless `fail-on-warnings` is `true`. A date one day ahead of the runner's date doesn't warn as "in the future", since the maintainer's local date can be ahead of UTC.
- The body check ignores HTML comments, and warns when there's no text after the front matter, when the body has only headings, or when a "How AI Was Used" section is empty, such as when the rating form's placeholder comment is left in.
- Warns when the ACR badge in the README shows a different rating from `ACR.md`, so a badge doesn't go stale when the rating changes. Works with Markdown, HTML and reStructuredText READMEs, and looks for the README where GitHub does (`.github/`, the root, then `docs/`). Badges keep loading from shields.io, so nothing depends on aicoderating.com.
- If `ACR.md` isn't found, a file whose name differs only in case (such as `acr.md`) is checked instead, as the spec says tools should. An empty or missing file is an error.
- Each result is an annotation on the right line, plus a summary table on the run page and the outputs `rating`, `errors` and `warnings`.
- No dependencies and no build step. 29 tests. Listed on the GitHub Marketplace as "AI Code Rating Check".
