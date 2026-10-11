FROM n8nio/n8n:latest

USER root

# Install ffmpeg, python3, curl if needed for custom local scripts
RUN apk add --no-cache ffmpeg curl

USER node
