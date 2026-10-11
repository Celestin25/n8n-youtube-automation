FROM n8nio/n8n:latest

USER root

# Modern n8nio/n8n images are Debian/Ubuntu based (glibc)
RUN if command -v apk > /dev/null 2>&1; then \
        apk add --no-cache ffmpeg curl; \
    elif command -v apt-get > /dev/null 2>&1; then \
        apt-get update && apt-get install -y --no-install-recommends ffmpeg curl && rm -rf /var/lib/apt/lists/*; \
    fi

USER node
