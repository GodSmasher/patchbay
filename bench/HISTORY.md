# patchbay benchmark history

Ten common integrations, live Nemotron on Nebius Token Factory, Tavily for docs, local runner (tsc + vitest).
Each pass changed one thing in patchbay; the generated connectors are never edited by hand.

| Pass | Change before the pass | Green | Green on the first draft | Cost |
| --- | --- | --- | --- | --- |
| 1 | Contract tests from the official docs, official sources first | 7/10 | 1/10 | $0.50 |
| 2 | Typed fakeFetch in fixtures.ts, contract must actually pass | 7/10 | 0/10 | $0.50 |
| 3 | Test helpers behave like real HTTP (status text, raw + parsed body, Headers), JSON retry for plan/spec | 8/10 | 7/10 | $0.34 |

Pass details: [first](RESULTS-first-pass.md) · [second](RESULTS-second-pass.md) · [third](RESULTS-third-pass.md). Full event logs of the latest pass are in `runs/`.

Remaining failures in pass 3:
- Typeform → Pipedrive: typecheck on spreading the untyped example payload, not fixed within 3 attempts.
- Intercom → Zendesk: the model added webhook signature verification and fed a string where node:crypto expects a Buffer.
