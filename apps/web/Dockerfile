# Stage 1: Build
FROM node:20-slim AS builder

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy lockfile and workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy all package.json files to install dependencies efficiently
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build-time environment variables for Next.js prerendering
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the web app
RUN pnpm --filter @nexus-os/web build

# Stage 2: Production
FROM node:20-slim AS runner

WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the built application
# Next.js standalone output maps files relative to the standalone directory
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Note: standalone server.js is located at the root of the standalone folder
CMD ["node", "apps/web/server.js"]