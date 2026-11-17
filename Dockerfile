# Stage 1: Build the React frontend using Vite
FROM node:22-alpine AS frontend-builder
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Set up the Python Flask backend
FROM python:3.11-slim

# Install system dependencies (including postgresql-client for pg_isready)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt backend/requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock

# Copy backend application code and operational scripts
COPY backend/ ./
COPY scripts/ ./scripts/

# Preserve bundled static uploads so they can be seeded onto a mounted Persistent Disk (e.g. Render) at startup
RUN mkdir -p /app/_bundled_uploads && \
    cp -rn /app/app/static/uploads/. /app/_bundled_uploads/ 2>/dev/null || true && \
    cp -rn /app/uploads/. /app/_bundled_uploads/ 2>/dev/null || true

# Copy the built React assets from the node stage
COPY --from=frontend-builder /workspace/backend/app/static/app /app/app/static/app
COPY --from=frontend-builder /workspace/backend/app/static/diagnosis-wizard /app/app/static/diagnosis-wizard

# Expose the Flask default port
EXPOSE 5000

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

# Run the startup script
ENTRYPOINT ["/app/entrypoint.sh"]
