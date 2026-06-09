# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────
# Family Chat — production image
#
# Bun installs the workspace (it's the repo's package manager), but the build
# itself runs under Node, and the final stage runs Next's standalone server on
# slim Node — so the runtime image stays small and carries only the traced
# dependencies.
#
# Why Node (not Bun) runs `next build`: Bun's module resolver fails to load the
# externalized `jsdom` (pulled in by isomorphic-dompurify) during Next's
# page-data collection on Linux, throwing on a nested relative require inside
# css-tree. Node resolves it correctly. Bun is still used for the install.
#
# Build:  docker build -t family-chat .
# Run:    docker run --env-file .env -p 5766:5766 family-chat
#
# All real configuration is read from the container environment at RUNTIME (via
# --env-file). The image bakes in no instance config or secrets — the app reads
# even its one public client value (the VAPID key) from the server at runtime,
# so there are no NEXT_PUBLIC_* values to inline at build time. The single
# build-time variable below is a fixed, fake placeholder needed only so module
# imports don't throw while Next collects page data; it lives only in the
# builder stage and never reaches the final image.
# ──────────────────────────────────────────────────────────────────────────

ARG BUN_VERSION=1.3.9
ARG NODE_VERSION=22

# ── deps: install the full workspace with the committed lockfile ────────────
FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app

# Copy only the manifests first so the install layer caches across source edits.
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

RUN bun install --frozen-lockfile

# ── builder: compile the Next standalone output (under Node) ────────────────
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Fixed, fake build-only placeholder. The DB client throws at import if
# DATABASE_URL is unset and Next imports it while collecting page data;
# postgres.js connects lazily, so nothing actually connects during the build.
# This value is identical for every build, carries no secret, and exists only
# in this builder stage — the real URL is supplied at runtime via --env-file.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Bun installs binaries per-workspace (e.g. apps/web/node_modules/.bin/next),
# not all hoisted to root — so carry over every node_modules tree from deps,
# then overlay the source (node_modules is .dockerignore'd, so it's preserved).
COPY --from=deps /app ./
COPY . .

# Build the web app directly with Node. Going through `turbo`/the bun-managed
# npm script would run next under Bun (see the jsdom note above); invoking the
# next binary with Node sidesteps that. Workspace packages are consumed as
# source via transpilePackages, so they need no separate build step.
WORKDIR /app/apps/web
RUN node node_modules/next/dist/bin/next build

# ── runner: minimal Node image that runs the standalone server ─────────────
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5766
ENV HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# The standalone bundle already contains a minimal node_modules and the server
# entrypoint. Static assets and public/ are not traced, so copy them in beside
# the server at the same monorepo-relative paths Next expects.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 5766

CMD ["node", "apps/web/server.js"]
