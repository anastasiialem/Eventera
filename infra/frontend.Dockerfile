# Eventera frontend: Vite build → nginx.
# Build context — корінь репозиторію:
#   docker build -f infra/frontend.Dockerfile -t eventera-frontend \
#     --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... .
# VITE_* вшиваються в JS під час збірки (це публічні значення). service_role сюди НІКОЛИ не передавати.
# Без VITE_SUPABASE_* сайт теж збереться й працюватиме на моках.

# ---- 1. build ----
# Node 22 LTS (Node 20 — EOL з квітня 2026; Vite 8 потребує >=20.19, CI теж на 22)
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_API_URL=""
ARG VITE_BACKEND_URL=""
ARG VITE_DONATE_URL=""
ARG VITE_VIP_PAY_URL=""
ARG VITE_VIP_NOTE=""
ARG VITE_TELEGRAM_BOT_URL=""
ARG VITE_ENABLE_GOOGLE="false"
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_API_URL=$VITE_API_URL \
    VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_DONATE_URL=$VITE_DONATE_URL \
    VITE_VIP_PAY_URL=$VITE_VIP_PAY_URL \
    VITE_VIP_NOTE=$VITE_VIP_NOTE \
    VITE_TELEGRAM_BOT_URL=$VITE_TELEGRAM_BOT_URL \
    VITE_ENABLE_GOOGLE=$VITE_ENABLE_GOOGLE

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --fetch-retries=5 --fetch-timeout=120000

COPY frontend/ ./
RUN npm run build

# ---- 2. serve ----
FROM nginx:alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
