# Nexus OS Architecture Overview

## High-Level Diagram

```
[Client] <-> [API Server] <-> [Redis] <-> [BullMQ Workers]
                        |           |
                        v           v
                  [Supabase]   [EventBus/SSE]
```

- **API Server**: Handles HTTP/SSE, orchestrates missions, validates input, exposes health endpoints.
- **Master Brain**: Stateless coordinator, schedules and reflects on missions, stores state in Redis/Supabase.
- **Workers**: Execute tasks from BullMQ queues, stateless, auto-restart via PM2/Docker.
- **Redis**: Queue backend, cache, pub/sub for event bus.
- **Supabase**: Persistent storage for missions, tasks, users, artifacts.
- **EventBus/SSE**: Real-time updates to clients.

## Key Flows
- All state is externalized (Redis/Supabase) for horizontal scaling.
- Circuit breakers and retries wrap all external API calls.
- Health endpoints for all services.

## ADRs
- See `/docs/adr/` for architecture decision records.

## Diagrams
- Add/update diagrams as the system evolves.
