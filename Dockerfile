# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Install Google Chrome for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

# Tell Puppeteer to skip installing Chromium since we'll be using the installed version
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set environment variables for Render.com
ENV RENDER=true
ENV DOCKER_CONTAINER=true

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY server/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY server/ ./

# Create a non-root user and switch to it
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# Expose the port
EXPOSE 10000

# Start the application
CMD ["npm", "start"]