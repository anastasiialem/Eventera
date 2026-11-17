# Eventera parser (Роль 1): збирає події Львова й пише в Supabase. Одноразовий запуск.
# Build context — backend/:
#   docker build -f infra/parser.Dockerfile -t eventera-parser backend
#   docker run --rm --env-file .env eventera-parser
# Потрібні змінні: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; опційно PARSER_SOURCES (напр. "karabas").
# У продакшені парсер запускає GitHub Actions (.github/workflows/parser.yml), цей образ — для локального запуску.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv

COPY parser/requirements.txt parser/requirements.txt
RUN pip install -r parser/requirements.txt

COPY parser parser

# непривілейований користувач
RUN useradd --create-home --uid 10001 app
USER app

CMD ["python", "-m", "parser.run", "--db"]
