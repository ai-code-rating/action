# AI Code Rating Check

[![ACR B4c](https://img.shields.io/badge/ACR-B4c-2140B5)](ACR.md)

A GitHub Action that checks a repository's `ACR.md` against the [AI Code Rating](https://aicoderating.com) spec. It runs the same checks as the [validator](https://aicoderating.com/validate/), and also checks that the README's badge matches the rating:

- **Errors** fail the check: a missing or invalid rating, spec version or date, and broken front matter.
- **Warnings** show as notes on the file but pass: an unlikely rating, a rating last checked over a year ago, a missing plain-English paragraph, or an ACR badge in the README that shows a different rating from `ACR.md`. Set `fail-on-warnings` to make them fail too.

Each problem is shown on the line of `ACR.md` it's about, in pull requests and in the run's summary.

Don't have an `ACR.md` yet? [Get your rating](https://aicoderating.com/#rate).

## Usage

Add `.github/workflows/acr.yml` to your repository:

```yaml
name: ACR

on:
  push:
    paths: [ACR.md]
  pull_request:
    paths: [ACR.md]
  schedule:
    - cron: "0 6 * * 1" # weekly, so a rating that's over a year old gets flagged

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ai-code-rating/action@v1
```

To check the file on every push instead, drop the two `paths` lines. To also catch a README badge that's out of step with the rating, add your README to `paths` too, such as `paths: [ACR.md, README.md]`.

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `path` | `ACR.md` | Path to the rating file, relative to the repository root. If there's no file with that exact name, one whose name differs only in case, such as `acr.md`, is used. |
| `fail-on-warnings` | `false` | Set to `true` to fail the check on warnings too, such as a rating last checked over a year ago. |

```yaml
      - uses: ai-code-rating/action@v1
        with:
          fail-on-warnings: true
```

## Outputs

| Output | Meaning |
|---|---|
| `rating` | The rating, such as `A2b`. Empty if it isn't valid. |
| `errors` | Number of errors found. |
| `warnings` | Number of warnings found. |

## Development

The checks themselves live in the [aicoderating.com](https://github.com/ai-code-rating/aicoderating.com) repo, so the Action and the validator page always agree. Everything in `lib/` is copied from there by its `scripts/sync-action.mjs`, so change the checks there, not here. The Action has no dependencies and no build step.

Run the tests with `node test/run.cjs` (add `-v` to see the Action's output for each sample).

## Licence

MIT. `lib/js-yaml.cjs` is [js-yaml](https://github.com/nodeca/js-yaml), MIT (`lib/js-yaml.LICENSE`). The AI Code Rating spec is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
