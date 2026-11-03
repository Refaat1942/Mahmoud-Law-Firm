# syntax=docker/dockerfile:1
# One image serves both the web app and the worker; docker-compose.yml builds it once.
# Layers are ordered so an ordinary code update only rebuilds the app output: dependencies
# are reinstalled only when package-lock.json (or the Prisma schema) changes.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl \
  && npm install -g npm@11.20.0
WORKDIR /app

# Everything needed to build.
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Runtime needs only the Prisma CLI and client (migrations and the worker); the web app
# carries its own traced dependencies in .next/standalone. Installing just these two
# keeps ~1 GB of build tooling out of the image.
FROM base AS runtime-deps
COPY package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  V=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") \
  && npm init -y >/dev/null \
  && npm install --omit=dev --no-audit --no-fund "prisma@$V" "@prisma/client@$V"
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The .next/cache mount keeps compiler caches between builds on the same server.
RUN --mount=type=cache,target=/app/.next/cache npx prisma generate && npm run build \
  && npx esbuild worker=src/jobs/worker.ts seed=prisma/seed.ts --bundle --platform=node --target=node22 --format=cjs \
       --outdir=dist --external:@prisma/client --external:.prisma --external:@node-rs/argon2 --log-level=warning

FROM node:22-alpine AS runner
WORKDIR /app
# Docker sets HOSTNAME to the container id; Next standalone binds to it, so
# 127.0.0.1 inside the container (used by deploy/vps.sh) would not answer.
ENV NODE_ENV=production TZ=Asia/Dubai HOSTNAME=0.0.0.0 PORT=3000
RUN apk add --no-cache postgresql16-client tzdata libc6-compat openssl
# Rarely changing layer first so it stays cached across updates.
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/messages ./messages
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
