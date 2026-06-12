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

# Sentry (all optional). NEXT_PUBLIC_SENTRY_DSN is inlined into the client
# bundle, so it must be present at build time to enable browser error reporting;
# leaving it empty ships a Sentry-free client. SENTRY_ORG/PROJECT enable
# source-map upload. The build no-ops Sentry when these are unset.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG SENTRY_ORG=""
ARG SENTRY_PROJECT=""
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV SENTRY_ORG=${SENTRY_ORG}
ENV SENTRY_PROJECT=${SENTRY_PROJECT}

# Bun installs binaries per-workspace (e.g. apps/web/node_modules/.bin/next),
# not all hoisted to root — so carry over every node_modules tree from deps,
# then overlay the source (node_modules is .dockerignore'd, so it's preserved).
COPY --from=deps /app ./
COPY . .

# Build the web app directly with Node. Going through `turbo`/the bun-managed
# npm script would run next under Bun (see the jsdom note above); invoking the
# next binary with Node sidesteps that. Workspace packages are consumed as
# source via transpilePackages, so they need no separate build step.
#
# SENTRY_AUTH_TOKEN (for source-map upload) is passed as a build secret so it
# never lands in an image layer; source-map upload is skipped when it's absent:
#   docker build --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN ...
WORKDIR /app/apps/web
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN,required=false \
    node node_modules/next/dist/bin/next build

# ── migrate-builder: bundle the standalone DB migrator (under Bun) ──────────
# The runtime image is a slim Next standalone build and carries neither
# drizzle-kit (a devDependency) nor the migration SQL — so we can't run
# `drizzle-kit migrate` there. Instead bundle the runtime `drizzle-orm`
# migrator (packages/db/src/migrate.ts) into one self-contained script. This
# stage has Bun and the installed workspace from `deps`.
FROM deps AS migrate-builder
WORKDIR /app
COPY . .
RUN bun build packages/db/src/migrate.ts --target=node --outfile=/app/migrate.mjs

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

# The self-contained migrator bundle plus the migration SQL it reads at runtime
# (MIGRATIONS_DIR=/app/drizzle, set by the entrypoint). The entrypoint applies
# pending migrations before starting the server.
COPY --from=migrate-builder --chown=nextjs:nodejs /app/migrate.mjs ./migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/drizzle ./drizzle
COPY --chown=nextjs:nodejs --chmod=0755 docker-entrypoint.sh ./docker-entrypoint.sh

USER nextjs

EXPOSE 5766

# Confirm the Next server is actually serving (not merely that the process is
# up) by hitting the unauthenticated /api/health route. Node 22 has global fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:5766/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Apply pending migrations (toggle with RUN_MIGRATIONS_ON_START), then exec the
# Next standalone server. See docker-entrypoint.sh for the separate-step option.
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# ── Nightly unread-digest cron (external) ───────────────────────────────────
# The digest endpoint GET /api/cron/daily-digest is inert until something calls
# it hourly. It must run at the TOP OF EVERY HOUR (it emails whichever opted-in
# users are at their local midnight) and authenticate with the CRON_SECRET env
# value. Wire it from outside the container — e.g. a host crontab entry:
#
#   0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
#       http://localhost:5766/api/cron/daily-digest > /dev/null
#
# or your platform's scheduler hitting the same URL. No CRON_SECRET ⇒ disabled
# (the route 401s).
