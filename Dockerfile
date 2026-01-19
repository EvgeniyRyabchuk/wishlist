FROM node:18-alpine

# Install Chromium for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 👇 MOVE INTO SERVER DIR EARLY
WORKDIR /app/server

# Copy only server package files
COPY server/package*.json ./

# Install deps (npm now sees package.json)
RUN npm install --omit=dev

# Copy server source
COPY server/ ./

# (Optional) client if your server serves it
COPY client/ ../client/

EXPOSE 10000

CMD ["node", "server.js"]
