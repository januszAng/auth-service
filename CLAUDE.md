# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Identity & Access Management (IAM) microservice — standalone authentication service communicating over gRPC. Built outside the main monorepo.

## Stack

- **Runtime:** Bun (runs TypeScript directly, no compilation step)
- **API layer:** Connect-RPC (gRPC-compatible) over HTTP/2 via `@connectrpc/connect-node`
- **Contract:** Protocol Buffers in `proto/auth.proto` — the source of truth for the API
- **Database:** PostgreSQL via `drizzle-orm` + `postgres.js` driver, migrations managed by Drizzle Kit
- **Auth:** JWT (HS256 via `jose`), bcrypt password hashing (Bun native, cost 12)
- **Validation:** Zod schemas, errors surfaced as `ConnectError` with gRPC status codes
- **Logging:** Custom structured JSON logger (no external dependency)

## Commands

| Command | Description |
|---|---|
| `bun run dev` | Start with hot reload |
| `bun run start` | Production start |
| `bun test` | Run all tests (also runs on `git commit` via pre-commit hook) |
| `bun test --coverage` | Run tests with coverage |
| `bun test --test-name-pattern "register"` | Run tests matching a pattern |
| `bun run check` | Lint + format check (Biome) |
| `bun run check:fix` | Auto-fix lint and format issues |
| `bun run format` | Format only |
| `bun run lint` | Lint only |
| `bun run buf:generate` | Regenerate gRPC stubs from `proto/*.proto` into `src/gen/` |
| `bun run db:generate` | Generate SQL migrations from Drizzle schema changes |
| `bun run db:migrate` | Run pending migrations |
| `bun run db:push` | Push schema directly to database (dev only, skips migration files) |

## Architecture

### Request flow

```
Client (gRPC/Connect)
  → HTTP/2 server (node:http2)
    → connectNodeAdapter (routes by service/method)
      → AuthServiceImpl (src/services/auth.ts)
        → Zod validation → DB query / JWT / bcrypt → response
```

### Proto → code generation

`proto/auth.proto` defines the `auth.v1.AuthService` with 4 unary RPCs: `Register`, `Login`, `VerifyToken`, `RefreshToken`. Running `bun run buf:generate` produces:

- `src/gen/auth_pb.ts` — message types + service descriptor (protoc-gen-es)
- `src/gen/auth_connect.ts` — Connect-RPC transport definitions (protoc-gen-connect-es)

These generated files are committed. After changing a `.proto` file, re-run `buf generate` and commit the updated stubs.

### Server startup

`index.ts` → `startServer()` in `src/server.ts` creates an HTTP/2 server with the Connect-RPC adapter, mounts `AuthService`, listens on `PORT` (default 50051). `setupGracefulShutdown` hooks `SIGTERM`/`SIGINT` for clean shutdown with a 5-second forced-kill timeout.

### Service implementation pattern

Each RPC handler in `src/services/auth.ts` follows this pattern:
1. Validate input with the corresponding Zod schema — throw `ConnectError(Code.InvalidArgument, ...)` on failure
2. Perform business logic (DB lookup, password verify, JWT create/verify)
3. Return the proto response shape

All errors use `ConnectError` with appropriate gRPC status codes (`InvalidArgument`, `AlreadyExists`, `Unauthenticated`, `Internal`). Handlers use a child logger tagged `{ component: "auth" }`.

### Database

Drizzle ORM with `postgres.js` driver. Schema is defined in `src/db/schema/users.ts` and re-exported from `src/db/schema/index.ts`. The `users` table has: `id` (uuid PK, auto-generated), `email` (unique, not null), `password_hash`, `role` (default `'user'`), `created_at`, `updated_at`.

The connection module (`src/db/connection.ts`) auto-connects on import and exports both the Drizzle `db` client and the raw `client` for direct SQL.

### JWT

Access tokens (15 min TTL) and refresh tokens (7 day TTL), both HS256-signed. Claims: `sub` (user ID), `email`, `role`, `iss` (`auth-service`), `aud` (`proton`), `iat`, `exp`. Secret from `JWT_SECRET` env var. Token rotation on refresh — a new pair is issued each time.

### Validation

Zod schemas in `src/lib/validation.ts`. Password rules: 10–128 chars, must include uppercase, lowercase, digit, and special character. Email: valid format, max 255 chars. Login password is validated as non-empty only (strength check only on register).

## Testing

Tests are co-located as `*.test.ts` files and use Bun's built-in test runner. The database is fully mocked via `mock.module()` from `bun:test` — there are no integration tests, so tests run without a real database. Mock chaining pattern for db queries:

```ts
const mockDb = { select: () => mockDb, from: () => mockDb, where: () => mockDb };
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | (see .env.example) | PostgreSQL connection string |
| `JWT_SECRET` | (required) | 64-char hex string for signing tokens |
| `PORT` | `50051` | gRPC server port |
| `LOG_LEVEL` | `info` | trace/debug/info/warn/error/fatal |
| `DB_POOL_MAX` | `5` | Max DB connections |
| `DB_CONNECT_TIMEOUT` | `10` | Connection timeout (seconds) |

## Commit conventions

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/). Enforced by commitlint via a Husky `commit-msg` hook. Formatting and linting by Biome.
