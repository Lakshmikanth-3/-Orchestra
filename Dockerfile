# Orchestra ASP — always-on host image (PRD: "a listed ASP cannot cold-sleep")
#
# IMPORTANT — outbound payments need a real onchainos wallet session.
# This image bundles the real onchainos v4.2.4 Linux binary (checksum-verified
# against the same release used in development), but it ships with NO wallet
# session baked in — that would embed a live, signable session inside a
# shareable artifact, which is a real security risk, not a hypothetical one.
#
# Before this container can make a real paid CoinAnk call, run ONE of:
#   1. `onchainos wallet login <email>` inside the running container (interactive,
#      one-time), then persist /root/.onchainos as a volume so the session
#      survives restarts/redeploys; or
#   2. Mount a volume at /root/.onchainos containing session.json + wallets.json
#      copied out-of-band from a machine that already logged in (never via git,
#      never baked into the image).

FROM node:22-bookworm-slim AS base
RUN corepack enable
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# --- Download & verify the real onchainos CLI binary (matches ~/.agents install) ---
FROM base AS onchainos-fetch
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp/onchainos
RUN curl -fsSL -O "https://github.com/okx/onchainos-skills/releases/download/v4.2.4/onchainos-x86_64-unknown-linux-gnu" \
 && curl -fsSL -o checksums.txt "https://github.com/okx/onchainos-skills/releases/download/v4.2.4/checksums.txt" \
 && grep "onchainos-x86_64-unknown-linux-gnu$" checksums.txt | sha256sum -c - \
 && mv onchainos-x86_64-unknown-linux-gnu onchainos \
 && chmod +x onchainos

# --- Install full deps (needed to run `next build`) ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# --- Production-only deps for the runtime image ---
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# --- Runtime ---
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=onchainos-fetch /tmp/onchainos/onchainos /usr/local/bin/onchainos
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.ts ./

VOLUME ["/app/data", "/root/.onchainos"]
EXPOSE 3000
CMD ["pnpm", "start"]
