FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app ./
COPY docker/entrypoint.sh /usr/local/bin/vase-entrypoint
RUN chmod +x /usr/local/bin/vase-entrypoint
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/vase-entrypoint"]
