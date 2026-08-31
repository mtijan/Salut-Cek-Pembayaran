# Stage 1: Build Frontend-Admin SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app/Frontend-Admin

COPY Frontend-Admin/package*.json ./
RUN npm ci

COPY Frontend-Admin/ ./
RUN npm run build

# Stage 2: Production Runtime
FROM python:3.11-slim AS runtime

ARG RELEASE_ID=unknown

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RELEASE_ID=${RELEASE_ID}

LABEL org.opencontainers.image.revision=${RELEASE_ID}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY Backend/ ./Backend/
COPY Frontend/ ./Frontend/

# Copy built admin SPA assets from builder stage
COPY --from=frontend-builder /app/Frontend/admin-dist ./Frontend/admin-dist

# Create directory for persistent data (SQLite & imports)
RUN mkdir -p /app/Backend/data/imports

EXPOSE 8000

CMD ["uvicorn", "Backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
