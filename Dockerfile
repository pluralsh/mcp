# ---------- Build Stage ----------
FROM node:22.12-alpine AS builder

WORKDIR /app

# Copy full project files (for npm install to resolve everything)
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

# Optional: add .npmrc or .env if needed

# Use mount cache for faster installs (works only with BuildKit)
RUN --mount=type=cache,target=/root/.npm npm ci

# Compile TypeScript
RUN npx tsc

# ---------- Production Stage ----------
FROM node:22-alpine AS release

WORKDIR /app

ENV NODE_ENV=production

# Copy only necessary production files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/dist ./dist

RUN npm ci --omit=dev --ignore-scripts

ENTRYPOINT ["node", "dist/index.js"]
