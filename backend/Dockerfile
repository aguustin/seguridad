# Imagen Debian (bookworm-slim), no Alpine — el módulo nativo `canvas`
# (usado por face-api para procesar las fotos de reconocimiento facial)
# depende de cairo/pango/jpeg vía node-gyp, y en Alpine (musl) suele fallar
# la compilación o el runtime.

# ── Etapa de build: compila canvas y el resto de node_modules ──────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# ── Etapa final: solo las librerías de RUNTIME (sin los -dev / build-essential) ──
FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY . .

# El volumen de uploads se monta acá (ver docker-compose.yml) — se crea el
# directorio por si el volumen arranca vacío.
RUN mkdir -p uploads/profiles

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
