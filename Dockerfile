FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl \
  && npm install -g npm@11.20.0
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat openssl \
  && npm install -g npm@11.20.0
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# Docker sets HOSTNAME to the container id; Next standalone binds to it, so
# 127.0.0.1 inside the container (used by deploy/vps.sh) would not answer.
ENV NODE_ENV=production TZ=Asia/Dubai HOSTNAME=0.0.0.0 PORT=3000
RUN apk add --no-cache postgresql16-client tzdata libc6-compat openssl
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/messages ./messages
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
