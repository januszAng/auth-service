# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Identity & Access Management (IAM) microservice, developed outside the main monorepo.

## Stack

- **Runtime:** Bun (natively compiled, near-zero cold starts)
- **API layer:** gRPC with Protocol Buffers (contract-first)
- **Language:** TypeScript (implied by Bun + gRPC ecosystem)
- **Crypto:** Native hashing via Bun APIs

## Architecture (as described in README)

- Standalone microservice communicating with other services over gRPC.
- API surface is defined in `.proto` files; server stub and (if needed) client stubs are generated from those definitions.
- Follows a contract-first pattern — proto definitions are the source of truth for API boundaries.

## Commit conventions

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/). Commitlint with `@commitlint/config-conventional` is enforced via a Husky `commit-msg` hook.

## Commands

- `bun run index.ts` — start the service
- `bun test` — run tests (also runs automatically on `git commit` via the pre-commit hook)
- `npx commitlint --edit` — lint the current commit message manually
