#!/bin/sh
# Container entrypoint: apply pending DB migrations, then start the server.
#
# Migrations run by default on every start (RUN_MIGRATIONS_ON_START=true) so a
# deploy is a single step. The migrator takes a Postgres advisory lock, so it's
# safe if several replicas boot at once. To run migrations as a separate
# pipeline step instead, set RUN_MIGRATIONS_ON_START=false and invoke the
# migrator directly before rolling the app:
#
#     docker run --env-file .env --entrypoint node family-chat /app/migrate.mjs
set -e

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
    echo "[entrypoint] running database migrations…"
    MIGRATIONS_DIR=/app/drizzle node /app/migrate.mjs
else
    echo "[entrypoint] RUN_MIGRATIONS_ON_START=false — skipping migrations"
fi

echo "[entrypoint] starting server…"
exec node /app/apps/web/server.js
