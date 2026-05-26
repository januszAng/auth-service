# Identity & Access Management (IAM) Service

This repository contains an independent authentication microservice designed to operate outside the main monorepo. It leverages gRPC for low-latency, strongly-typed internal communication between services.

### Key Features
- **Natively Compiled:** Built on Bun for near-zero cold starts and memory efficiency.
- **Contract-First:** API boundaries defined strictly via Protocol Buffers (`.proto`).
- **Secure by Default:** Utilizes native cryptographic hashing algorithms for user security.
