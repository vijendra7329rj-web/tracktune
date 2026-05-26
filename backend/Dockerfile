# ─────────────────────────────────────────────────────────
# TrackTune Backend — Dockerfile
# Node.js 20 + FFmpeg + yt-dlp + python3
# ─────────────────────────────────────────────────────────
FROM node:20-slim

# Install system dependencies:
#   - ffmpeg: audio extraction & processing
#   - python3: required by yt-dlp for some extractors
#   - ca-certificates & curl: HTTPS support for downloading yt-dlp
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      ca-certificates \
      curl && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp binary (standalone, no pip needed)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Default port (Render uses 10000)
ENV PORT=10000
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/healthz || exit 1

# Run migrations, then start the server
CMD ["sh", "-c", "node src/migrate.js && node src/index.js"]
