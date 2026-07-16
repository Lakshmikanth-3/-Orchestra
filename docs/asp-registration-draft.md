# Orchestra — ASP Registration Draft

Prepared against the real field constraints in the OKX.AI registration flow
(`identity-register.md` §3). Host is Render (see `render.yaml`) — fill in the
endpoint once the service is actually deployed there and has a real URL.
Everything else is ready to paste in as-is.

## Step 1 — Identity

**Role:** ASP

**Name (brand, 3–25 EN chars):**
```
Orchestra
```

**Description (one sentence, ≤500 chars):**
```
Orchestra is a finance research conductor that hires and pays other live
agents on OKX.AI to turn one intent and one budget into a complete,
itemized market research brief.
```

**Avatar:** `docs/asp-avatar.png` (512×512, 1:1, ~10KB — well under the
1MB limit). Rendered from the PRD's real design tokens (pit background,
brass note, staff lines) via `scripts/render-avatar.mjs` — regenerate
with `node scripts/render-avatar.mjs` if you want a different look.

## Step 2 — Service

**Service name (5–30 noun phrase, distinct from the agent name):**
```
Finance Research Conductor
```

**Service description (2 parts, separate lines, ≤200 chars each):**
```
Turns one goal and a USDT budget into a full research brief: pulls real
derivatives market data, scans current news, flags concrete risk signals,
and synthesizes it into one itemized, sourced report.
You provide: 1. the research intent (token, topic, or question) 2. a USDT
budget ceiling for hiring sub-agents.
```

**Type:** `A2MCP`

**Fee:** `0.5` (USDT is the implicit default — sent as a plain digit
string, no unit/symbol)

**Endpoint:** `https://orchestra-asp.onrender.com/api/orchestrate`
— live, verified: `/api/health` returns 200 and `/api/orchestrate` correctly
demands real payment (402), confirmed 2026-07-16.

## Notes

- Every line above respects the registration flow's real constraints:
  no tech-stack details, no GitHub/wallet links, no example prompts, no
  disclaimers, no price mentioned in the service name.
- The flow requires **all services in one message** before any QA pass —
  Orchestra registers as a single A2MCP service, so no "add another
  service" loop is needed.
- `validate-listing` runs its own QA pass at registration time; treat
  this draft as the starting point, not the final text — the flow may
  suggest edits.
