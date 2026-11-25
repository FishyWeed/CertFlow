# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@12.10.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm@12.10.1

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    BODY_SIZE_LIMIT=50M \
    CERTFLOW_SELF_HOSTED=true \
    CERTFLOW_DATA_DIR=/data \
    STORAGE_DRIVER=local \
    LOCAL_UPLOAD_DIR=/data/uploads

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/start.mjs ./scripts/start.mjs

RUN mkdir -p /data/uploads /data/pgdata

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "scripts/start.mjs"]
