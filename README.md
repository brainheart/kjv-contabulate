# kjv-contabulate

Search the King James Bible by token, phrase, and regex across testaments, books, chapters, verses, and verse text.

This repo contains:

- A Python build pipeline (`build.py`) that reads the KJV OSIS XML source in `osis/`.
- A static web UI in `docs/` for GitHub Pages.
- Python and Playwright tests for data and UI behavior.

## Corpus

- Source: `osis/eng-kjv.osis.xml`
- Upstream text: [seven1m/open-bibles](https://github.com/seven1m/open-bibles)
- Scope: Old Testament + New Testament
- Default build excludes the apocrypha/deuterocanon section present in the upstream OSIS file.

## Build Data

Generate or regenerate the site data:

```bash
python3 build.py
```

Outputs:

- `docs/data/plays.json` for books
- `docs/data/chunks.json` for verses
- `docs/data/tokens.json`, `tokens2.json`, `tokens3.json`
- `docs/lines/all_lines.json` for verse-text search

`docs/CNAME` is set to `kjv.contabulate.org`.

## Run Locally

```bash
python3 -m http.server 8766 -d docs
```

Then open [http://localhost:8766](http://localhost:8766).

## Tests

Python:

```bash
python3 -m pytest tests test_parse_play.py -v
```

Playwright:

```bash
npm install
npx playwright install
npx playwright test
```

## Notes

- Generated JSON under `docs/data/` and `docs/lines/` is committed output for the static site.
- The frontend keeps the original Contabulate interaction model where practical, but remaps the hierarchy to testament/book/chapter/verse.
