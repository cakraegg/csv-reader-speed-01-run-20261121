# csv-reader-speed: single-pass regex-scan drop-in

[![csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/competitions/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/cakraegg/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/competitions/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/cakraegg/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/competitions/csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0, entered in the
[csv-reader-speed-01-run-20261121 competition on make.fun](https://make.fun/competitions/csv-reader-speed-01-run-20261121).
It returns exactly csv-reader's answer — `{columns, rows, errors}` — for
every input, including its broken-row policy (stray CRs, unterminated
quotes, quote junk, short and long rows), and nothing else.

## How it is fast

The reference walks the text one character at a time and grows every
field a character at a time. This entry reads the text once, left to
right, but takes each field in whole slices between the few characters
that can end or change it, found with a native regex scan. No
dependencies, no randomness, no per-character loop, deterministic output.

## Layout

- `solve.js` — the reader: `run({text, header})` returns
  `{columns, rows, errors}`.
- `main.ts` — the harness driver: reads `cases.json`, answers each case
  with `run()`, writes `answers.json`.
- `package.json` — `{"type": "module"}`.

## License

MIT — see [LICENSE](LICENSE).
