# Stage 1: Build
FROM node:18-slim AS builder

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy lockfile and workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy all package.json files to install dependencies efficiently
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the API
RUN pnpm --filter @nexus-os/api build

# Stage 2: Production
FROM node:18-slim AS runner

WORKDIR /app

# Install pnpm for production installs
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copy built files and production-essential files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/types ./packages/types

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Expose port
EXPOSE 3001

# Start the API
CMD ["node", "apps/api/dist/index.js"]
