// Puppeteer configuration for different environments
const puppeteerConfig = {
  // Common options
  headless: "new", // Use new headless mode for better stability
  // Prevent issues with running as root in containers
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--single-process', // Added for better stability on Render
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-blink-features=AutomationControlled',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-extensions',
    '--disable-backgrounding-occluded-windows',
    '--disable-features=NetworkService',
    '--disable-features=VizServiceWorker',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-background-networking',
    '--max_old_space_size=4096',
    '--disable-features=VizMain',
    '--disable-features=SpareRendererForSitePerProcess',
    '--disable-features=OutOfBlinkCors',
    '--memory-pressure-off'
  ]
};

// Determine the executable path based on environment
if (process.env.NODE_ENV === 'production') {
  // On Render, try multiple possible paths for Chrome/Chromium
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH, // Use environment variable if set
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium'
  ];

  for (const path of possiblePaths) {
    if (path) {
      try {
        // Check if the file exists by attempting to access it
        const fs = require('fs');
        if (fs.existsSync(path)) {
          puppeteerConfig.executablePath = path;
          break;
        }
      } catch (e) {
        // If fs module isn't available or there's an error checking, continue to next path
        continue;
      }
    }
  }
  
  // If no executable path was found, Puppeteer will use its default (which might fail in production)
  if (!puppeteerConfig.executablePath) {
    console.warn('Warning: Could not find a suitable Chrome/Chromium executable in production environment');
  }
}

module.exports = puppeteerConfig;