# Stage 1: Build the React frontend using Vite
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
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
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application code
COPY . .

# Copy the built React assets from the node stage
COPY --from=frontend-builder /app/static/diagnosis-wizard /app/app/static/diagnosis-wizard

# Expose the Flask default port
EXPOSE 5000

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

# Run the startup script
ENTRYPOINT ["/app/entrypoint.sh"]
