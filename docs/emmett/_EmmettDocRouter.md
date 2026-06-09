# Emmett Framework — Guides Router

> **Category**: External Framework / Side Projects
> **Status**: ✅ Active
> **Last Updated**: 2026-05-25

## What This Is

[Emmett](https://event-driven-io.github.io/emmett/) is a TypeScript Event Sourcing framework by Event-Driven.io. These guides help developers adopt Emmett for **side projects** while keeping a production DDD/CQRS stack unchanged.

Emmett favors **functional Deciders** (`decide` / `evolve`) over class-based aggregates, **composition over magic**, and **integration-first testing**.

## When to Use Emmett vs Traditional DDD Framework

| Use Emmett | Use Traditional DDD Framework |
| ---------- | ----------------------------- |
| Personal / side projects | Production platform |
| Greenfield microservices | Bounded contexts inside `packages/backend` |
| MongoDB event store + inline read models | MongoDB + Framework UI |
| Lightweight Express/Fastify/Hono APIs | TypeDI + CommandPipeline + Framework UI |

## Guide Index

| Document | Purpose |
| -------- | ------- |
| [Getting Started](./Getting-Started.md) | Install, core concepts, shopping cart walkthrough, production setup |
| [DDD Framework vs Emmett](./DDD-vs-Emmett.md) | Concept mapping from DDD Framework to Emmett |
| [Masterplan Index](./Masterplans/README.md) | Step-by-step aggregate slice guides (mirrors `agg-masterplan` series) |
| [Emmett Adapters — Minimal Path (Spec)](./Emmett-Adapters.spec.md) | Functional deciders + optional `runCommand`; legacy modules — see Entity Kit for greenfield |
| [Entity Kit — Set A (Spec)](./Emmett-EntityKit.spec.md) | **`EntityRoot`**, **`Outcome`**, **`EntityRef`**, **`projectReadModel`**, **`runEntity`** — no `@sp/common-domain` |

## Masterplan Series (Agent Rules)

Cursor agent rules for Emmett aggregate implementation live in `.cursor/rules/Backend/emmett-masterplan/`:

| Rule | Layer |
| ---- | ----- |
| `emmett-masterplan-1-domain.mdc` | State, events, commands, Decider |
| `emmett-masterplan-2-commands.mdc` | CommandHandler, HTTP API, testing |
| `emmett-masterplan-3-projections.mdc` | Inline MongoDB projections, read models, queries |
| `emmett-masterplan-5-integration.mdc` | Cross-module reactions, subscriptions |

## Official Emmett Resources

| Resource | Link |
| -------- | ---- |
| Getting Started (official) | https://event-driven-io.github.io/emmett/getting-started.html |
| GitHub | https://github.com/event-driven-io/emmett |
| Samples | https://github.com/event-driven-io/emmett/tree/main/samples |

## Key Packages

| Package | Purpose |
| ------- | ------- |
| `@event-driven-io/emmett` | Core: Event/Command types, Decider, CommandHandler, in-memory store |
| `@event-driven-io/emmett-mongodb` | **Default for these guides** — MongoDB event store + inline projections |
| `@event-driven-io/emmett-expressjs` | Express app setup, `on()`, Problem Details, ApiSpecification |
| `@event-driven-io/emmett-postgresql` | PostgreSQL event store + Pongo projections (alternative adapter) |
| `@event-driven-io/emmett-esdb` | EventStoreDB adapter |
| `@event-driven-io/emmett-sqlite` | SQLite adapter |
| `mongodb` | MongoDB driver (peer dependency of emmett-mongodb) |

## MongoDB Sample

Official reference implementation: [expressjs-with-mongodb](https://github.com/event-driven-io/emmett/tree/main/samples/webApi/expressjs-with-mongodb)
