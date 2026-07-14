# 🎼 Orchestra — One intent in. An agent economy out.

The first ASP on OKX.AI that is also a *customer* of OKX.AI: it hires, pays,
and settles other live agents to deliver one goal under one budget.

**Live listing:** _pending marketplace registration_ · **Mission Control:** _pending deploy_ ·
**X Layer mainnet escrow:** _pending deploy_ (verified) · **Demo:** _pending_

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
- **`lib/planner.ts`** — real `@anthropic-ai/sdk` call (Claude Sonnet 5, structured outputs via
  `output_config.format` + Zod) producing a budget-capped, dependency-ordered task DAG.
- **`lib/skills/`** — internal, Claude-backed capabilities (`news_scan`, `risk_flags` use the
  real hosted `web_search` tool; `synthesize_report` reasons only over data gathered by
  earlier tasks). Always labeled `internal` in the ledger and report — never disguised as
  an external hire.
- **`lib/coinank.ts` + `lib/onchainos.ts`** — the real market-data capability: calls
  `open-api.coinank.com`, and on a genuine HTTP 402 shells out to the already-authenticated
  `onchainos` CLI (`payment pay` / `payment charge`) to sign and pay via the real Agentic
  Wallet, then replays the request. `lib/token-decimals.ts` resolves the real ERC-20
  `decimals()` on-chain (viem) so costs are never guessed.
- **`lib/executor.ts`** — topological wave executor (`Promise.all` per wave), 60s per-task
  timeout, dependency-failure cascade, and refundable-budget accounting.
- **`lib/ledger.ts`** — SQLite (libsql) run ledger: `planned/hired/paid/delivered/failed/settled`
  events, streamed live via `app/api/runs/[id]/stream` (SSE).
- **`lib/report.ts`** — the Score Report: itemized real costs, honest external/internal
  source attribution, Markdown + JSON.
- **`contracts/`** — `OrchestraEscrow.sol`, a Foundry project. 6/6 tests passing
  (lock/settle payout math, refund, duplicate-id guard, access control). Deploy + verify
  on OKLink in one step (see `contracts/script/Deploy.s.sol` for the full command):
  `forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.xlayer.tech --private-key $DEPLOYER_PRIVATE_KEY --broadcast --verify --verifier oklink --verifier-url https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER --verifier-api-key $OKLINK_API_KEY`.

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
| `ANTHROPIC_API_KEY` | planner + internal skills |
| `ORCHESTRA_AGENTIC_WALLET` | Orchestra's real EVM address (from `onchainos wallet balance`) |
| `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` | inbound x402 facilitator (OKX Developer Portal) |
| `DEPLOYER_PRIVATE_KEY` | X Layer mainnet contract deploy (never pasted in chat — fill directly in `.env`) |
| `OKLINK_API_KEY` | optional — contract source verification on OKLink |
| `ORCHESTRA_OPERATOR_KEY` | Mission Control's own operator-run path |

The `onchainos` CLI must be installed and logged in (`onchainos wallet login <email>`) on
whatever host runs this service — outbound CoinAnk payments are signed through that session,
not through a key stored in this repo.

## Tests

```bash
pnpm test              # real unit tests for schema validation + market-data routing
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
