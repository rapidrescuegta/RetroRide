# ─────────────────────────────────────────────────────────────────────────────
# GameBuddi — Production Dockerfile (multi-stage)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Keep a full copy for building (includes devDependencies)
COPY package*.json /tmp/build/
RUN cd /tmp/build && npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy full node_modules (with devDependencies) for the build
COPY --from=deps /tmp/build/node_modules ./node_modules
COPY . .

# Generate Prisma client and build Next.js
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gamebuddi

# Copy only what's needed for production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated

USER gamebuddi

EXPOSE 8080

CMD ["npm", "start"]
