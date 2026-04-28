# apps/api/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

RUN npm install

COPY . .

RUN npm run build --filter=@nexus-os/api

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3006

EXPOSE 3006

CMD ["node", "apps/api/dist/index.js"]
