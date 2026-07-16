# 🎼 Orchestra — One intent in. An agent economy out.

The first ASP on OKX.AI that is also a *customer* of OKX.AI: it hires, pays,
and settles other live agents to deliver one goal under one budget.

**Live listing:** _pending marketplace registration_ · **Mission Control:** [orchestra-asp.onrender.com](https://orchestra-asp.onrender.com) ·
**X Layer mainnet escrow:** _pending deploy_ (verified on testnet) · **Demo:** _pending_

## How Orchestra runs on the OKX stack

| Rail | Where |
|---|---|
| x402 / Agent Payments Protocol | inbound gate `app/api/orchestrate/route.ts` (via `@okxweb3/x402-next`) **and** outbound hires `lib/coinank.ts` + `lib/onchainos.ts` |
| Agentic Wallet | identity + treasury — logged in via `onchainos wallet login`; real EVM address in `.env` (`ORCHESTRA_AGENTIC_WALLET`) |
| OKX.AI marketplace | listed A2MCP service (pending registration); consumes the live CoinAnk ASP at `open-api.coinank.com` |
| Onchain OS | registration + wallet binding via the `onchainos` CLI (v4.2.4) |
| X Layer | `contracts/OrchestraEscrow.sol` — per-task micro-escrow, chainId 196, RPC `https://rpc.xlayer.tech` |

## Architecture

One Next.js 16 (App Router, TypeScript) app, plus one Foundry contract project:

- **`app/api/orchestrate`** — the real, paid A2MCP entry point. Wrapped with `withX402()`
  from OKX's real seller SDK; requires `OKX_API_KEY`/`OKX_SECRET_KEY`/`OKX_PASSPHRASE`
  (apply at the [OKX Developer Portal](https://web3.okx.com/onchainos/dev-portal)).
- **`app/api/mc/orchestrate`** — same-origin operator route for the Mission Control UI itself
  (PRD FR-7's "manual UI runs may use an operator API key" path). The operator secret never
  reaches the browser bundle.
- **`lib/planner.ts`** — real call to Groq (`openai/gpt-oss-120b`, structured outputs via
  strict JSON Schema, validated again with Zod on the way in) producing a budget-capped,
  dependency-ordered task DAG.
- **`lib/skills/`** — internal capabilities (`news_scan`, `risk_flags` use Anthropic's
  real hosted `web_search` tool for cited results; `synthesize_report` reasons over data
  gathered by earlier tasks via Groq, no tool use needed). Always labeled `internal` in the
  ledger and report — never disguised as an external hire.
- **`lib/coinank.ts` + `lib/onchainos.ts`** — the real market-data capability: calls
  `open-api.coinank.com`, and on a genuine HTTP 402 shells out to the already-authenticated
  `onchainos` CLI (`payment pay` / `payment charge`) to sign and pay via the real Agentic
  Wallet, then replays the request. `lib/token-decimals.ts` resolves the real ERC-20
  `decimals()` on-chain (viem) so costs are never guessed.
- **`lib/executor.ts`** — topological wave executor (`Promise.all` per wave), 60s per-task
  timeout, dependency-failure cascade, and refundable-budget accounting. After a real
  external-ASP payment settles, it also fires the `lib/escrow.ts` on-chain mirror
  (see below) when configured — a mirror failure is recorded on the event, never thrown,
  since the real payment already happened regardless.
- **`lib/ledger.ts`** — SQLite (libsql) run ledger: `planned/hired/paid/delivered/failed/settled`
  events, streamed live via `app/api/runs/[id]/stream` (SSE).
- **`lib/report.ts`** — the Score Report: itemized real costs, honest external/internal
  source attribution, Markdown + JSON.
- **`lib/escrow.ts`** — the on-chain mirror (PRD §7.5 Vision Layer): after a real CoinAnk
  payment, calls `lock()` then `settle()` on the deployed `OrchestraEscrow` (X Layer
  mainnet, viem), keyed by `keccak256(runId:taskId)` so plan task ids that repeat across
  runs never collide on-chain. Entirely optional — unset `ORCHESTRA_ESCROW_ADDRESS` and
  it's skipped, since it mirrors an already-completed payment rather than gating it.
- **`contracts/`** — `OrchestraEscrow.sol`, a Foundry project. 6/6 tests passing
  (lock/settle payout math, refund, duplicate-id guard, access control). Deploy + verify
  on OKLink in one step (see `contracts/script/Deploy.s.sol` for the full command):
  `forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.xlayer.tech --private-key $DEPLOYER_PRIVATE_KEY --broadcast --verify --verifier oklink --verifier-url https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER --verifier-api-key $OKLINK_API_KEY`.
  After deploy, set `ORCHESTRA_ESCROW_ADDRESS` to the printed address to turn on the mirror.

## No-mock mandate (owner directive)

Every payment reference, tx hash, data payload, and log line this service produces comes
from the real call it claims to be. If an external dependency fails, the run fails loudly
with an itemized error and a refundable balance — Orchestra never quietly substitutes a
fallback, a simulated response, or invented data.

## Quickstart

```bash
pnpm install
cp .env.example .env   # fill in real values — see comments in the file
pnpm dev
```

Required for a fully live run:

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | planner (`lib/planner.ts`) + report synthesis (`lib/skills/synthesize-report.ts`) — free tier at console.groq.com |
| `ANTHROPIC_API_KEY` | news-scan + risk-flags internal skills only — needs Anthropic's hosted `web_search` tool for real cited results |
| `ORCHESTRA_AGENTIC_WALLET` | Orchestra's real EVM address (from `onchainos wallet balance`) |
| `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` | inbound x402 facilitator (OKX Developer Portal) |
| `DEPLOYER_PRIVATE_KEY` | X Layer mainnet contract deploy (never pasted in chat — fill directly in `.env`); also signs the runtime escrow mirror calls in `lib/escrow.ts` |
| `OKLINK_API_KEY` | optional — contract source verification on OKLink |
| `ORCHESTRA_OPERATOR_KEY` | Mission Control's own operator-run path |
| `ORCHESTRA_ESCROW_ADDRESS` | optional — deployed `OrchestraEscrow` address; unset skips on-chain mirroring |
| `ESCROW_MIRROR_VALUE_WEI` | optional — per-task mirror value in OKB wei, defaults to 0.0001 OKB |

The `onchainos` CLI must be installed and logged in (`onchainos wallet login <email>`) on
whatever host runs this service — outbound CoinAnk payments are signed through that session,
not through a key stored in this repo.

## Tests

```bash
pnpm test               # fast, hermetic unit tests (schema, ledger, report, CoinAnk decode logic)
pnpm test:live          # real network test against the live CoinAnk API (no credentials needed)
cd contracts && forge test   # contract tests (6/6 passing)
```

## Docker

```bash
docker build -t orchestra-asp .
docker run -p 3000:3000 -v orchestra-data:/app/data -v orchestra-wallet:/root/.onchainos orchestra-asp
```

See the comment block at the top of `Dockerfile` — the container needs its own `onchainos`
wallet session (via `onchainos wallet login` inside the running container, persisted through
the mounted volume), never one baked into the image.

## Deploying to Render (free tier)

`render.yaml` is a ready-to-use [Blueprint](https://render.com/docs/blueprint-spec) that builds
straight from `Dockerfile` and wires up `/api/health` as the health check.

1. Push this repo to GitHub (Render deploys from a connected Git repo).
2. In the Render dashboard: **New > Blueprint**, point it at the repo — it reads `render.yaml`
   automatically.
3. Fill in the secret env vars Render will prompt for (`ANTHROPIC_API_KEY`,
   `ORCHESTRA_AGENTIC_WALLET`, `OKX_API_KEY`/`OKX_SECRET_KEY`/`OKX_PASSPHRASE`,
   `OKLINK_API_KEY`, `ORCHESTRA_OPERATOR_KEY`) — same values as your local `.env`.
4. After first deploy, open a shell on the instance (Render dashboard > Shell) and run
   `onchainos wallet login <email>` once so outbound CoinAnk payments have a real signed
   session to use.

**Known free-tier trade-off (not hidden):** Render's free plan has no persistent disk and
spins the instance down after ~15 minutes idle. That means the SQLite ledger
(`ORCHESTRA_DB_PATH`) and the `onchainos` wallet session from step 4 do **not** survive a
redeploy or a cold-start recycle — every idle-then-woken instance starts with an empty
ledger and a logged-out wallet. This conflicts with the PRD's "a listed ASP cannot cold-sleep"
requirement (§7.1). The real fix is a paid instance + persistent disk; free tier is what's
running for now because that's what's available, not because the gap is invisible.
