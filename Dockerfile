# Dokubolaget — single-container image.
#
# Stage 1 builds the static Expo web bundle with Node (Metro needs Node).
# Stage 2 is a small Bun image that serves the bundle, proxies Systembolaget,
# and runs the daily board pipeline. See Dokubolaget/server.js.
#
#   docker build -t dokubolaget .
#   docker run -p 8080:8080 --env-file .env dokubolaget

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

RUN npm install -g bun@1

WORKDIR /app/Dokubolaget
COPY Dokubolaget/package.json Dokubolaget/bun.lockb ./
RUN bun install --frozen-lockfile

COPY Dokubolaget/ ./

# Web build points its proxy and API at the same origin.
# Local testing only: "true" offers every theme without unlocking it.
ARG EXPO_PUBLIC_UNLOCK_ALL_THEMES=
ENV EXPO_PUBLIC_CORS_PROXY=/proxy?url= \
    EXPO_PUBLIC_UNLOCK_ALL_THEMES=$EXPO_PUBLIC_UNLOCK_ALL_THEMES \
    CI=1

RUN bun run build:web

# ---------------------------------------------------------------------------
FROM oven/bun:1-slim AS runtime

WORKDIR /app/Dokubolaget

# The runtime only needs nodemailer (password reset emails). Everything else
# in package.json is app/build tooling, so install just this one to keep the
# image small. Keep the version in step with devDependencies in package.json.
RUN echo '{"name":"dokubolaget-runtime","private":true}' > package.json \
 && bun add nodemailer@10.0.13 \
 && rm -rf ~/.bun/install/cache

COPY --from=build /app/Dokubolaget/dist ./dist
COPY Dokubolaget/server.js Dokubolaget/proxyPolicy.js Dokubolaget/tsconfig.json ./
COPY Dokubolaget/server ./server
COPY Dokubolaget/src/theme/types.ts ./src/theme/types.ts
COPY Dokubolaget/scripts ./scripts
COPY Dokubolaget/src/boardTags.ts ./src/boardTags.ts
COPY Dokubolaget/data ./data

# The daily catalog download is written to /app/products.json, and the
# database lives in /data, so the unprivileged user needs to own both.
RUN mkdir -p /data && chown -R bun:bun /app /data
VOLUME /data
USER bun

ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/dokubolaget.sqlite

EXPOSE 8080

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD bun -e "fetch('http://localhost:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["bun", "run", "server.js"]
