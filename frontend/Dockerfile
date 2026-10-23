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
# Feature flags are inlined at build time (frontend/.env is not part of the image).
ENV NEXT_PUBLIC_FEATURE_AI_RESUME_PARSING=true
ENV NEXT_PUBLIC_FEATURE_BULK_RESUME_IMPORT=true
ENV NEXT_PUBLIC_FEATURE_CANDIDATE_INTELLIGENCE=true
ENV NEXT_PUBLIC_FEATURE_AI_JOB_DESCRIPTION=true
ENV NEXT_PUBLIC_FEATURE_CANDIDATE_MATCHING=true
ENV NEXT_PUBLIC_FEATURE_CANDIDATE_RANKING=true
ENV NEXT_PUBLIC_FEATURE_MATCH_OVERRIDES=true
ENV NEXT_PUBLIC_FEATURE_MATCH_SCORING_PROFILES=true
ENV NEXT_PUBLIC_FEATURE_SEMANTIC_SEARCH=true
ENV NEXT_PUBLIC_FEATURE_SEMANTIC_SEARCH_EXPANSION=true
ENV NEXT_PUBLIC_FEATURE_SAVED_SEARCHES=true
ENV NEXT_PUBLIC_FEATURE_SEARCH_HISTORY=true
ENV NEXT_PUBLIC_FEATURE_SEARCH_SUGGESTIONS=true
ENV NEXT_PUBLIC_FEATURE_SIMILAR_CANDIDATE_SEARCH=true
ENV NEXT_PUBLIC_FEATURE_SIMILAR_JOB_SEARCH=true
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

WORKDIR /app/frontend

EXPOSE 3000

CMD ["node", "server.js"]