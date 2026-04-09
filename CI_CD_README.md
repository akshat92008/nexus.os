# Nexus OS CI/CD Pipeline with Mission Replay

This document describes the CI/CD pipeline and end-to-end testing setup for the Nexus OS project.

## Overview

The CI/CD pipeline provides:
- Automated testing with unit tests, integration tests, and end-to-end tests
- Mission replay capability for deterministic testing
- Docker container builds for both API and web applications
- Comprehensive linting and type checking

## Pipeline Structure

### Jobs

1. **lint-and-typecheck**: Runs linting and TypeScript type checking
2. **unit-tests**: Runs unit tests with Redis service
3. **e2e-tests**: Runs end-to-end tests with Redis and PostgreSQL services
4. **docker-build**: Builds and pushes Docker images (only on main branch)

### Services

- **Redis**: For caching and queue management
- **PostgreSQL**: For data persistence in tests

## Mission Replay System

The mission replay system enables deterministic testing of agent orchestration by:

1. **Recording Mode** (`MISSION_REPLAY_MODE=record`):
   - Records all agent interactions during mission execution
   - Saves inputs, outputs, and metadata to JSON files
   - Used during development to create test fixtures

2. **Replay Mode** (`MISSION_REPLAY_MODE=replay`):
   - Loads recorded interactions from previous runs
   - Returns pre-recorded responses instead of calling LLMs
   - Ensures tests are deterministic and fast

### Usage

```bash
# Record new test fixtures
pnpm test:e2e:record

# Run tests with recorded responses
pnpm test:e2e:replay

# Run tests with live responses (for development)
pnpm test:e2e
```

## Test Structure

### Unit Tests (`src/__tests__/*.test.ts`)
- Test individual components and functions
- Fast execution, no external dependencies
- Run with `pnpm test`

### Integration Tests (`src/__tests__/*.integration.test.ts`)
- Test component interactions
- May require external services (marked with `.skip` by default)
- Run with `pnpm test`

### E2E Tests (`src/__tests__/e2e/*.e2e.test.ts`)
- Test complete mission orchestration workflows
- Use mission replay for deterministic results
- Test API endpoints and full request/response cycles
- Run with `pnpm test:e2e`

## Environment Variables

### For CI/CD
- `REDIS_URL`: Redis connection URL (default: `redis://localhost:6379`)
- `DATABASE_URL`: PostgreSQL connection URL for tests
- `MISSION_REPLAY_MODE`: `record`, `replay`, or unset (default: record in CI)

### For Docker Builds
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password

## Local Development

### Prerequisites
- Node.js 20+
- pnpm 9.5.0+
- Docker and Docker Compose (for services)

### Running Tests Locally

```bash
# Install dependencies
pnpm install

# Start test services
docker-compose up -d redis postgres

# Run all tests
pnpm test

# Run e2e tests with recording
pnpm test:e2e:record

# Run e2e tests with replay
pnpm test:e2e:replay
```

### Test Services

Start the test infrastructure:

```bash
docker-compose -f docker-compose.test.yml up -d
```

This starts:
- Redis on port 6379
- PostgreSQL on port 5432

## Docker Images

The pipeline builds two Docker images:

- `nexus-os/api`: Node.js API server with agent orchestration
- `nexus-os/web`: Next.js web application

Images are pushed to Docker Hub on successful builds of the main branch.

## Mission Replay Files

Test recordings are stored in `apps/api/test-recordings/` with the format:
```
{missionId}-{timestamp}.json
```

Example:
```json
{
  "missionId": "test-mission-123",
  "sessionId": "test-session-456",
  "userId": "test-user",
  "startTime": 1640995200000,
  "endTime": 1640995260000,
  "interactions": [
    {
      "taskId": "research-1",
      "agentType": "researcher",
      "input": {
        "prompt": "Research AI developments",
        "context": {},
        "taskNode": { ... }
      },
      "output": {
        "type": "research",
        "data": { ... }
      },
      "timestamp": 1640995210000,
      "duration": 10000
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **Tests failing due to missing recordings**:
   - Run `pnpm test:e2e:record` first to create recordings
   - Ensure `test-recordings/` directory exists

2. **Docker build failures**:
   - Check that `next.config.js` has `output: 'standalone'`
   - Verify all dependencies are properly declared

3. **CI timeouts**:
   - E2E tests have 60-second timeout per test
   - Check for slow network requests or infinite loops

### Debugging

Enable verbose logging:
```bash
DEBUG=* pnpm test:e2e
```

Check test recordings:
```bash
ls -la apps/api/test-recordings/
cat apps/api/test-recordings/*.json | jq .
```