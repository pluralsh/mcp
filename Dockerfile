# ---------- Build Stage ----------
FROM node:22.12-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN --mount=type=cache,target=/root/.npm npm ci
RUN npx tsc --project tsconfig.build.json

# ---------- Production Stage ----------
FROM node:22-alpine AS release

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tsconfig.json ./

RUN npm ci --omit=dev --ignore-scripts

ENTRYPOINT ["node", "dist/index.js"]
