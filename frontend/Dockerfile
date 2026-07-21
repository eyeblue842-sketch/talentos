FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
WORKDIR /app/frontend
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
