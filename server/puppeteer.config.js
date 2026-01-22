// Puppeteer configuration for different environments
const puppeteerConfig = {
  // Common options
  headless: "new", // Use new headless mode for better stability
  // Prevent issues with running as root in containers
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-zygote',
    '--single-process',

    // 🔥 CRITICAL on Render
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-features=site-per-process',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-popup-blocking',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
    '--safebrowsing-disable-auto-update',

    // Additional flags for stability
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-blink-features=AutomationControlled',
    '--disable-renderer-backgrounding',
    '--disable-features=NetworkService',
    '--disable-features=VizServiceWorker',
    '--disable-features=TranslateUI',
    '--max_old_space_size=4096',
    '--disable-features=VizMain',
    '--disable-features=SpareRendererForSitePerProcess',
    '--disable-features=OutOfBlinkCors',
    '--memory-pressure-off',
    '--disable-renderer-priority-changing',
    '--disable-background-media-suspend',
    '--pull-messages-from-layers',
    '--disable-threaded-animation',
    '--disable-threaded-scrolling',
    '--disable-touch-drag-drop',
    '--disable-features=VizDisplayCompositor',
    '--disable-gpu-sandbox',
    '--disable-extensions-http-throttling'
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