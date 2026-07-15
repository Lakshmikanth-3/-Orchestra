# Orchestra — 90-Second Demo Script (PRD §10)

Grounded in what's actually built and verified this session — every beat below
maps to a real UI element or a real backend event, not a planned/aspirational
one. Record only once the full chain is live (Anthropic key, funded wallet,
OKX facilitator creds, deployed host — see the credentials checklist at the
end).

| t | Beat | What's actually on screen |
|---|---|---|
| 0–10s | **Hook.** "Agents can work. Can they *hire*?" Type the intent into Mission Control: *"Full research brief on BTC — market structure, whale flows, news, risk flags. Budget: 1 USDT."* Click Run. | The real Intent Console (`app/page.tsx`) — textarea, budget stepper, Run button, pit/brass color scheme. |
| 10–25s | **Planner strikes.** The Score Rail populates with note-blocks the instant the `planned` SSE event arrives — one block per real task in the LLM-generated DAG (market_data, news_scan, risk_flags, synthesize_report), each hollow (`--rest`) until hired. | Real `lib/planner.ts` call (Claude Sonnet 5, structured output, zod-validated) → real `planned` ledger event → real SSE push to the browser. |
| 25–55s | **The money shot.** The `market_data` note-block pulses `--tuning` on `hired`, then strikes solid `--brass` the instant the real CoinAnk payment settles — the real payment reference (sha256-derived, not fabricated) types out beneath it in mono. Scroll the Settlement Ledger to the same `paid` event and point out the on-chain mirror: a real X Layer mainnet lock+settle tx hash from Orchestra's own treasury, next to the off-chain payment ref — the PRD's "DAG-node granularity" escrow claim, shown live, not asserted. The internal-skill blocks (`news_scan`/`risk_flags`) turn a distinct `--tuning`-filled "done" state, explicitly labeled *internal* — never disguised as a paid hire. | Real `lib/coinank.ts` → real `onchainos payment pay`/`charge` against the real Agentic Wallet → real `paid` event with the real settlement reference, plus `lib/escrow.ts`'s real `escrowLockTx`/`escrowSettleTx` on the same event when `ORCHESTRA_ESCROW_ADDRESS` is configured. |
| 55–75s | **Score Report.** Cut to the Settlement Ledger / report view: itemized real costs (CoinAnk's actual price, decoded live from its real 402 challenge — confirmed $0.001 for `/api/fundingRate/current` at the time of writing; whichever endpoint the plan actually calls, the price shown is whatever CoinAnk's real response says, never assumed), source attribution per section (external ASP vs internal skill, never blurred), and the refundable-budget line. "Here's exactly where your 1 USDT went." | Real `lib/report.ts` output — `GET /api/runs/:id/report`. |
| 75–90s | **Close.** "Orchestra — the first agent on OKX.AI that's both merchant and customer. One intent in, an agent economy out. `#OKXAI`" | — |

## Pre-recording checklist (FR-8 Demo Integrity — hard rule)

Do not record until every item below is genuinely true — not "should work,"
verified:

- [ ] `onchainos wallet balance` shows a real non-zero USDT balance
- [ ] A real end-to-end run has completed successfully at least once against
      the actual deployed (or local) service, producing a real `settled`
      event and a real Score Report
- [ ] The CoinAnk endpoint is confirmed live (`curl` a real 402) *immediately*
      before recording — FR-9 forbids recording against a dependency that
      might be down
- [ ] If showing the on-chain mirror: `ORCHESTRA_ESCROW_ADDRESS` points at a
      real, deployed-and-verified `OrchestraEscrow` on X Layer mainnet, and
      the treasury wallet actually holds enough OKB to cover
      `ESCROW_MIRROR_VALUE_WEI` for every task in the demo run — a failed
      lock/settle would show up honestly as `escrowLockError`/`escrowSettleError`
      in the ledger rather than a clean brass strike, which is correct
      behavior but not what you want mid-recording
- [ ] If demoing the live marketplace listing: the ASP registration
      (`docs/asp-registration-draft.md`) has actually been submitted and
      approved, and the endpoint in that draft has been replaced with the
      real deployed URL
- [ ] No task in the recorded run fails — if one does, that's a real problem
      to fix, not something to edit around (FR-8: "no invented logs")

## Credentials still needed before any of this is real (not just built)

See the main README's "Required for a fully live run" table:
`ANTHROPIC_API_KEY`, wallet funding, `OKX_API_KEY`/`OKX_SECRET_KEY`/`OKX_PASSPHRASE`,
`DEPLOYER_PRIVATE_KEY`, and a deployed host (Render blueprint ready — see
`render.yaml` — needs a GitHub remote + a Render account connected to it).
