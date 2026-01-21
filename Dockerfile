# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Install Chromium for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dbus \
    su-exec

# Set environment variables for Render.com
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Allow Puppeteer to run as root (needed in containers)
ENV PUPPETEER_USER_DATA_DIR=/tmp/puppeteer

# Set the working directory
WORKDIR /app/server

# Copy package.json and package-lock.json (if available)
COPY server/package*.json ./

# Install dependencies (single install!)
RUN npm install --production

# Copy app source
COPY server/ ./
COPY server/client/ ./client/

# Expose Render port
EXPOSE 10000

# Start app (without migrations in CMD)
CMD ["node", "server.js"]