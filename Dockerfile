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
ENV NODE_ENV=production

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY server/package*.json ./

# Copy config directory to allow migrations to run when container starts
COPY server/config ./config/

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy the rest of the application code
COPY server/ ./

# Install only production dependencies for the final image (removing dev dependencies)
RUN npm ci --only=production

# Install sequelize-cli as a separate step to run migrations
RUN npm install --no-save sequelize-cli

# Create a non-root user and switch to it
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of app directory to nextjs user
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose the port
EXPOSE 10000

# Run migrations and start the application
CMD ["sh", "-c", "npx sequelize db:migrate && npm start"]