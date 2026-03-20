FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM node:22-bookworm-slim AS server-deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    g++ \
    libcairo2-dev \
    libgif-dev \
    libgl1 \
    libjpeg62-turbo-dev \
    libpango1.0-dev \
    libpixman-1-dev \
    librsvg2-dev \
    make \
    pkg-config \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev


FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libcairo2 \
    libgif7 \
    libgl1 \
    libjpeg62-turbo \
    libpango-1.0-0 \
    libpixman-1-0 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8001

COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8001

CMD ["node", "server/index.js"]
