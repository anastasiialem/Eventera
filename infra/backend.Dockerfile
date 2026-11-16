# Eventera backend (API + Telegram-бот) для Render.
# Render → New Web Service → Docker:
#   Dockerfile Path:          infra/backend.Dockerfile
#   Docker Build Context Dir: backend
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv

COPY app/requirements.txt app/requirements.txt
RUN pip install --no-cache-dir -r app/requirements.txt

COPY app app

# Render передає порт у $PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
