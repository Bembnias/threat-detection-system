FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    ffmpeg \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --trusted-host pypi.python.org -r requirements.txt

COPY https /app/https/

COPY . .

ENV APP_PORT=8000

EXPOSE ${APP_PORT}

CMD uvicorn main:app --host 0.0.0.0 --port ${APP_PORT} --ssl-keyfile /app/https/key.pem --ssl-certfile /app/https/cert.pem