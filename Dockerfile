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

# Web build points its proxy at the same origin. Firebase config can be
# overridden here; empty args fall back to the values in src/firebaseConfig.ts.
ARG EXPO_PUBLIC_FIREBASE_API_KEY=
ARG EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
ARG EXPO_PUBLIC_FIREBASE_PROJECT_ID=
ARG EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
ARG EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
ARG EXPO_PUBLIC_FIREBASE_APP_ID=
ENV EXPO_PUBLIC_CORS_PROXY=/proxy?url= \
    EXPO_PUBLIC_FIREBASE_API_KEY=$EXPO_PUBLIC_FIREBASE_API_KEY \
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=$EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN \
    EXPO_PUBLIC_FIREBASE_PROJECT_ID=$EXPO_PUBLIC_FIREBASE_PROJECT_ID \
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=$EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET \
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    EXPO_PUBLIC_FIREBASE_APP_ID=$EXPO_PUBLIC_FIREBASE_APP_ID \
    CI=1

RUN bun run build:web

# ---------------------------------------------------------------------------
FROM oven/bun:1-slim AS runtime

WORKDIR /app/Dokubolaget

# The runtime only needs firebase-admin (for the seeder). Everything else in
# package.json is app/build tooling, so install just this one to keep the
# image small. Keep the version in step with devDependencies in package.json.
RUN echo '{"name":"dokubolaget-runtime","private":true}' > package.json \
 && bun add firebase-admin@^13.10.0 \
 && rm -rf ~/.bun/install/cache

COPY --from=build /app/Dokubolaget/dist ./dist
COPY Dokubolaget/server.js Dokubolaget/tsconfig.json ./
COPY Dokubolaget/scripts ./scripts
COPY Dokubolaget/src/boardTags.ts ./src/boardTags.ts
COPY Dokubolaget/data ./data

# The daily catalog download is written to /app/products.json, so the
# unprivileged user needs to own /app.
RUN chown -R bun:bun /app
USER bun

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD bun -e "fetch('http://localhost:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["bun", "run", "server.js"]
