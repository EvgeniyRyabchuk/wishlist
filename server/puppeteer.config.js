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
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-features=SpareRendererForSitePerProcess',
    '--disable-features=TranslateUI',
    '--disable-features=NetworkService',
    '--disable-features=VizMain',
    '--disable-site-isolation-trials',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TouchpadOverscrollHistoryNavigation',
    '--disable-ipc-flooding-protection',
    '--disable-background-timer-throttling',
    '--disable-background-networking',
    '--disable-extensions-http-throttling'
  ],
  // Add some additional options to improve stability
  devtools: false,
  defaultViewport: {
    width: 1024,
    height: 768
  }
};

// Determine the executable path based on environment and OS
const os = require('os');
const fs = require('fs');

// Always try to find the executable path regardless of environment
let possiblePaths = [
  process.env.PUPPETEER_EXECUTABLE_PATH, // Use environment variable if set
];

if (os.platform() === 'win32') {
  // Windows paths
  possiblePaths = possiblePaths.concat([
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
  ]).filter(Boolean);
} else {
  // Unix/Linux paths
  possiblePaths = possiblePaths.concat([
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ]);
}

for (const path of possiblePaths) {
  if (path && fs.existsSync(path)) {
    puppeteerConfig.executablePath = path;
    break;
  }
}

// If no executable path was found, Puppeteer will use its default
if (!puppeteerConfig.executablePath) {
  console.warn('Warning: Could not find a suitable Chrome/Chromium executable');
  console.warn('Puppeteer will use its default executable path');
  console.warn('Make sure Chrome or Chromium is installed on your system');
}

module.exports = puppeteerConfig;