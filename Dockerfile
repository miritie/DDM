# syntax=docker/dockerfile:1.6
# Multi-stage build pour Next.js — image finale légère et sans devDeps.

# -----------------------------------------------------------------------------
# Stage 1 : install deps (cache npm)
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Lockfile pour install reproductible
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# -----------------------------------------------------------------------------
# Stage 2 : build
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 : runtime — image minimale
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Utilisateur non-root
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Copie des artefacts buildés et deps prod uniquement
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/types ./types

USER nextjs
EXPOSE 3001

CMD ["npm", "start"]
