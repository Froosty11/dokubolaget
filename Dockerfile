# Dokubolaget — single-container image.
#
# Stage 1 builds the static Expo web bundle with Node (Metro needs Node).
# Stage 2 is a small Bun image that serves the bundle, proxies Systembolaget,
# and runs the daily board pipeline. See Dokubolaget/server.js.
#
#   docker build -t dokubolaget .
#   docker run -p 8080:8080 -v dokubolaget-data:/data --env-file .env dokubolaget

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

# The runtime only needs nodemailer (password reset emails) and qrcode (the
# admin script's poster codes). Everything else
# in package.json is app/build tooling, so install just these to keep the
# image small. Keep the versions in step with devDependencies in package.json.
RUN echo '{"name":"dokubolaget-runtime","private":true,"scripts":{"admin":"bun scripts/admin.ts"}}' > package.json \
 && bun add nodemailer@10.0.13 qrcode@1.5.4 \
 && rm -rf ~/.bun/install/cache

COPY --from=build /app/Dokubolaget/dist ./dist
COPY Dokubolaget/server.js Dokubolaget/proxyPolicy.js Dokubolaget/tsconfig.json ./
COPY Dokubolaget/server ./server
COPY Dokubolaget/src/theme/types.ts Dokubolaget/src/theme/packSchema.ts Dokubolaget/src/theme/contrast.ts ./src/theme/
# Club themes: loaded into the database at startup (server/themePacks.ts).
COPY club-themes /app/club-themes
COPY Dokubolaget/scripts ./scripts
COPY Dokubolaget/src/boardTags.ts Dokubolaget/src/gameDay.ts Dokubolaget/src/playable.ts Dokubolaget/src/scoring.ts ./src/
COPY Dokubolaget/data ./data

# The daily catalog download and the database both live on the /data volume
# (PRODUCTS_PATH, DB_PATH below), so a container recreate doesn't start with
# an empty catalogue; the unprivileged user needs to own it.
RUN mkdir -p /data && chown -R bun:bun /app /data
VOLUME /data
USER bun

ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/dokubolaget.sqlite \
    PRODUCTS_PATH=/data/products.json

EXPOSE 8080

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD bun -e "fetch('http://localhost:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["bun", "run", "server.js"]
