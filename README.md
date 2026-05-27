# Identity & Access Management (IAM) Service

Independent authentication microservice using gRPC with Protocol Buffers, built on Bun.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Bun](https://bun.sh) (for local development without Docker)
- [buf](https://buf.build) CLI (for gRPC client testing)

## Quick start (Docker)

```bash
# 1. Create your .env file
cp .env.example .env

# 2. Start the database and service
docker compose up --detach

# 3. Push the database schema (first run only)
DATABASE_URL="postgres://auth:strongpassword1*@127.0.0.1:5432/auth" npx drizzle-kit push

# 4. Smoke test
bun buf curl --protocol connect --schema proto/auth.proto \
  -d '{"email":"test@example.com","password":"Str0ngPass1!"}' \
  http://localhost:50051/auth.v1.AuthService/Register
```

## Environment variables

| Variable             | Default                                         | Description                                                           |
| -------------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| `POSTGRES_USER`      | `auth`                                          | PostgreSQL user                                                       |
| `POSTGRES_PASSWORD`  | `strongpassword1*`                              | PostgreSQL password                                                   |
| `POSTGRES_DB`        | `auth`                                          | PostgreSQL database name                                              |
| `DATABASE_URL`       | `postgres://auth:strongpassword1*@db:5432/auth` | Connection string (_use `db` as host in Docker, `127.0.0.1` locally_) |
| `JWT_SECRET`         | —                                               | 64-char hex string for signing tokens                                 |
| `PORT`               | `50051`                                         | gRPC server port                                                      |
| `LOG_LEVEL`          | `info`                                          | Log level: `trace`, `debug`, `info`, `warn`, `error`                  |
| `DB_POOL_MAX`        | `5`                                             | Max database connections                                              |
| `DB_CONNECT_TIMEOUT` | `10`                                            | Connection timeout in seconds                                         |

## Local development (without Docker)

```bash
# 1. Start only the database
docker compose up --detach db

# 2. Create .env with localhost connection
cat > .env << 'EOF'
POSTGRES_USER=auth
POSTGRES_PASSWORD=strongpassword1*
POSTGRES_DB=auth
DATABASE_URL=postgres://auth:strongpassword1*@127.0.0.1:5432/auth
JWT_SECRET=$(openssl rand -hex 32)
PORT=50051
EOF

# 3. Install dependencies
bun install

# 4. Push schema
npx drizzle-kit push

# 5. Start with hot reload
bun run dev
```

## Available commands

| Command                | Description                               |
| ---------------------- | ----------------------------------------- |
| `bun run dev`          | Start with hot reload                     |
| `bun run start`        | Start the service                         |
| `bun test`             | Run tests                                 |
| `bun run check`        | Lint and format check                     |
| `bun run check:fix`    | Auto-fix lint and format issues           |
| `bun run db:generate`  | Generate migrations from schema changes   |
| `bun run db:migrate`   | Run pending migrations                    |
| `bun run db:push`      | Push schema directly to database          |
| `bun run buf:generate` | Regenerate gRPC stubs from `.proto` files |

## Viewing logs

```bash
# Structured JSON logs (Docker)
docker logs auth-service

# With debug-level database query logging
LOG_LEVEL=debug docker compose up
```

## Project structure

```
.
├── proto/                  # .proto API definitions
├── src/
│   ├── db/
│   │   ├── connection.ts   # Database client and pooling
│   │   ├── schema/         # Drizzle ORM schema
│   │   └── migrations/     # SQL migration files
│   ├── gen/                # Generated gRPC stubs
│   ├── lib/                # JWT, password hashing, validation, logger
│   └── services/           # gRPC service implementations
├── docker-compose.yml
├── Dockerfile
└── drizzle.config.ts
```
