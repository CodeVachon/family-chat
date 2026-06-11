# Family Chat

A private, self-hostable group chat for your people — a small, real-time messaging app built as an installable PWA. Create channels, post richly formatted messages with mentions and emoji, react, share images and links, and get push notifications when you're away. New members request access and an admin approves them, so the space stays invite-only.

## Features

- **Real-time messaging** over Server-Sent Events backed by Postgres `LISTEN/NOTIFY` — no extra broker to run.
- **Rich text composer** (Tiptap) with **@mentions**, emoji, links with previews, and image attachments.
- **Channels**, message **reactions**, and read/typing indicators.
- **Authentication** via Better-Auth — email/password and magic links (email delivered through Resend).
- **Admin approval gate** — new sign-ups land in a pending state until an admin approves them.
- **Installable PWA** with **Web Push** background notifications.
- **Per-instance branding** — name and icon are configurable at runtime from the admin settings.
- **Light/dark theming** and a Slack-style mobile experience.

## Tech stack

| Area       | Choice                                        |
| ---------- | --------------------------------------------- |
| Framework  | Next.js 16 (App Router) + React 19            |
| Language   | TypeScript                                    |
| Styling/UI | Tailwind CSS v4 + shadcn/ui (`@workspace/ui`) |
| Database   | PostgreSQL 17 + Drizzle ORM (`@workspace/db`) |
| Auth       | Better-Auth                                   |
| Email      | Resend                                        |
| Media      | Cloudinary                                    |
| Editor     | Tiptap                                        |
| Tooling    | Bun (package manager) + Turborepo monorepo    |

## Repository layout

```
apps/
  web/                 Next.js application (the chat app)
packages/
  db/                  Drizzle schema, client, and migrations (@workspace/db)
  ui/                  Shared shadcn/ui components (@workspace/ui)
  eslint-config/       Shared ESLint config
  typescript-config/   Shared tsconfig bases
```

## Prerequisites

- [Bun](https://bun.sh) `1.3.9+`
- Node.js `>=20`
- A PostgreSQL `17` database (the included `docker-compose.yml` provides one)
- Accounts for [Resend](https://resend.com) (email) and [Cloudinary](https://cloudinary.com) (media), if you want those features

## Getting started

```bash
# 1. Install dependencies
bun install

# 2. Configure the environment
cp .env.example .env
#    then fill in the values (see "Configuration" below)

# 3. Start Postgres (uses docker-compose.yml)
docker compose up -d

# 4. Apply database migrations
bun run db:migrate

# 5. Run the dev server (http://localhost:5766)
bun dev
```

The **first account to sign up** automatically becomes the application Owner and is auto-approved; every account after that starts in a pending state and must be approved by the Owner (or an admin) before it can access the chat.

### Useful scripts

Run from the repo root (Turbo fans these out across the workspace):

| Command             | What it does                  |
| ------------------- | ----------------------------- |
| `bun dev`           | Start the app in development  |
| `bun run build`     | Production build              |
| `bun run lint`      | Lint                          |
| `bun run format`    | Format with Prettier          |
| `bun run typecheck` | Type-check the whole monorepo |

Database commands (also runnable from the repo root, e.g. `bun run db:migrate`):

| Command               | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `bun run db:generate` | Generate a migration from schema changes                             |
| `bun run db:migrate`  | Apply pending migrations (drizzle-kit; for local dev)                |
| `bun run db:deploy`   | Apply pending migrations with the runtime migrator (CI / production) |
| `bun run db:push`     | Push the schema directly (dev convenience)                           |
| `bun run db:studio`   | Open Drizzle Studio                                                  |

Both `db:migrate` and `db:deploy` apply the same migrations. `db:migrate` uses
`drizzle-kit` and is the everyday dev command; `db:deploy` runs the dependency-free
runtime migrator (`packages/db/src/migrate.ts`) under a Postgres advisory lock — it
needs no devDependencies, so it's what runs in CI and what the production container
runs on startup (see [Running with Docker](#running-with-docker)).

## Configuration

All configuration is read from the environment at runtime — see `.env.example` for the full list. Highlights:

| Variable                                                 | Purpose                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`                                           | Postgres connection string                                       |
| `BETTER_AUTH_SECRET`                                     | Auth signing secret — generate with `openssl rand -base64 32`    |
| `BETTER_AUTH_URL`                                        | Public base URL of the app                                       |
| `RESEND_API_KEY`, `EMAIL_FROM`                           | Transactional email + magic links                                |
| `CLOUDINARY_*`                                           | Media uploads                                                    |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push — generate keys with `npx web-push generate-vapid-keys` |

### Secrets & credentials

`.env` is gitignored (only `.env.example` is tracked) and the image bakes in no
secrets, so credentials never reach version control or a published image. They
**do** live in plaintext in your local `.env`, so:

- Treat the local `.env` as sensitive — don't commit it, paste it, or copy it
  into a shared machine, backup, or image layer.
- **Rotate any real credentials before sharing the machine or an image**, and
  rotate immediately if a key may have leaked. The third-party secrets here are
  the Resend API key (`RESEND_API_KEY`), the Cloudinary API secret
  (`CLOUDINARY_API_SECRET`), the VAPID private key (`VAPID_PRIVATE_KEY`), and the
  Sentry auth token (`SENTRY_AUTH_TOKEN`). Each is rotated from its own
  provider dashboard.
- `SENTRY_AUTH_TOKEN` can modify the Sentry org, so prefer a credential manager
  (e.g. 1Password's `op run`, `direnv` + the OS keychain, or your CI's secret
  store) over a flat file — and scope the token to source-map upload only.

## Running with Docker

The app ships a multi-stage `Dockerfile` that produces a small, self-contained image running Next's standalone server. The image bakes in **no** configuration or secrets — everything is supplied at runtime via `--env-file`.

```bash
# Build (no build args needed)
docker build -t family-chat .

# Run (configure entirely through your env file)
docker run --env-file .env -p 5766:5766 family-chat
```

The app listens on port **5766**. Point `DATABASE_URL` at a Postgres reachable from the container.

### Migrations on startup

The container applies any pending database migrations before starting the server, so a deploy is a single step — no separate migrate command needed. This is handled by `docker-entrypoint.sh`, which runs the bundled runtime migrator under a Postgres advisory lock (safe even if several replicas boot at once).

To run migrations as a separate pipeline step instead — e.g. once, before rolling the app across multiple replicas — disable the on-startup behavior with `RUN_MIGRATIONS_ON_START=false` and invoke the migrator directly:

```bash
docker run --rm --env-file .env --entrypoint node family-chat /app/migrate.mjs
```

## License

Released under the [MIT License](./LICENSE) — free to use, modify, and distribute.
