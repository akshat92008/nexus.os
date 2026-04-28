# apps/web/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

RUN npm install

COPY . .

RUN npm run build --filter=@nexus-os/web

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start", "--filter=@nexus-os/web"]