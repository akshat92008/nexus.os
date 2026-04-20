FROM node:20-alpine AS builder
WORKDIR /app

# 1. Install pnpm globally
RUN npm install -g pnpm

# 2. THE SKELETON: Copy all package metadata first
# Even if we only build the API, pnpm needs to see all package.json files
# to validate the frozen lockfile.
COPY pnpm-lock.yaml pnpm-workspace.yaml* package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

# 3. INSTALL: Optimized dependency fetch
RUN pnpm install --frozen-lockfile --filter @nexus-os/api...

# 4. SOURCE: Copy only what's needed for the API build
COPY packages/types/ ./packages/types/
COPY apps/api/ ./apps/api/

# 5. BUILD: Compile the API
WORKDIR /app/apps/api
RUN pnpm build

FROM node:20-alpine AS runner
RUN addgroup -S nexus && adduser -S nexus -G nexus
WORKDIR /app
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
RUN chown -R nexus:nexus /app
USER nexus
EXPOSE 8080
ENV PORT=8080
CMD ["npm", "run", "start"]
