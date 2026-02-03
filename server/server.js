const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Load environment variables

// Dynamically import Puppeteer to handle cases where it might not be available
let puppeteer;
const puppeteerConfig = require('./puppeteer.config.js');

try {
  puppeteer = require('puppeteer');
} catch (error) {
  console.error('Puppeteer not available:', error.message);
  console.error('Make sure to install Puppeteer with: npm install puppeteer');
}

const { sequelize } = require('./database/db'); // Import database connection
const db = require('./models'); // Import all models

// Log environment for debugging
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

const app = express();
const PORT = process.env.PORT || 3000; // Changed back to port 3000

// Middleware
app.use(cors());

// In production, trust proxies for correct IP addresses and HTTPS
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, './client'))); // Serve static files from the client directory

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    puppeteerAvailable: !!puppeteer
  });
});

// Puppeteer check endpoint
app.get('/puppeteer-status', async (req, res) => {
  try {
    if (!puppeteer) {
      return res.status(500).json({
        status: 'ERROR',
        message: 'Puppeteer is not available',
        available: false
      });
    }

    // Use the puppeteer configuration
    const browserOptions = {
      ...puppeteerConfig,
      ignoreHTTPSErrors: true,
      waitForInitialPage: false,
    };

    let browser;
    try {
      browser = await puppeteer.launch(browserOptions);
      const page = await browser.newPage();

      // Test navigation to ensure everything works
      await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 });

      await page.close();
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser in status check:', closeError);
        }
      }
    }

    res.status(200).json({
      status: 'OK',
      message: 'Puppeteer is available and working',
      available: true
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Puppeteer is available but not working properly',
      available: true,
      error: error.message
    });
  }
});

// Supported domains
const SUPPORTED_DOMAINS = [
  'rozetka.com.ua',
  'prom.ua',
  'olx.ua',
  'amazon.com',
  'ebay.com',
  'bestbuy.com',
  'target.com',
  'aliexpress.com',
  'walmart.com',
  'etsy.com',
  'newegg.com',
  'sephora.com',
  'zalando.de',
  'mediamarkt.de',
  'saturn.de',
  'apple.com',
  'samsung.com',
  'mediaexpert.pl',
  'morele.net',
  'x-kom.pl'
];

// Function to extract product info from a URL
async function extractProductInfo(url) {
  // Check if Puppeteer is available
  if (!puppeteer) {
    throw new Error('Puppeteer is not available. Browser automation is not possible.');
  }

  let browser;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Product extraction timed out after 20 seconds')), 20000) // Reduced from 60 to 20 seconds
  );

  // Main extraction logic wrapped in a promise for timeout
  const extractionPromise = (async () => {
    let page; // Declare page variable here so it's accessible in finally block
    try {
      // Validate URL
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      console.log(`Extracting product info from: ${url} (domain: ${domain})`);

      // Check if domain is supported
      const isSupported = SUPPORTED_DOMAINS.some(supportedDomain =>
        domain.includes(supportedDomain.replace('www.', '').split('.')[0])
      );

      if (!isSupported) {
        console.log(`Domain ${domain} is not in the supported list`);
        throw new Error(`Domain ${domain} is not supported`);
      }

      // Use the puppeteer configuration with additional options to prevent target closed errors
      const browserOptions = {
        ...puppeteerConfig,
        ignoreHTTPSErrors: true,
        waitForInitialPage: false,
      };

      browser = await puppeteer.launch(browserOptions);

      // Add error handlers to prevent target closed errors
      browser.on('disconnected', () => {
        console.log('Browser disconnected');
      });

      browser.on('targetchanged', (target) => {
        // Handle target changes
      });

      try {
        page = await browser.newPage();

        // Add error handling for page crashes
        page.on('error', (err) => {
          console.error('Page error:', err);
        });

        page.on('pageerror', (err) => {
          console.error('Page error event:', err);
        });
      } catch (pageError) {
        console.error('Error creating page:', pageError);
        throw new Error('Failed to create browser page. This might be due to Puppeteer/Chrome compatibility issues.');
      }

      // Set global timeouts (required)
      await page.setDefaultTimeout(30000); // Reduced to 30 seconds
      await page.setDefaultNavigationTimeout(30000); // Reduced to 30 seconds

      // Disable images & fonts for massive speed boost (especially on Render free tier)
      await page.setRequestInterception(true);
      page.on("request", req => {
        const type = req.resourceType();
        if (["image", "font", "media"].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Set a reasonable viewport
      await page.setViewport({ width: 1280, height: 800 });

      // Set extra HTTP headers including user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });

      // Minimal delay before navigation
      await new Promise(r => setTimeout(r, 200)); // Reduced from 1000ms to 200ms

      // Navigate to the URL with appropriate waitUntil (STOP using networkidle2 for Rozetka)
      console.log(`Navigating to: ${url}`);
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 15000, // Reduced to 15 seconds
        });
      } catch (navigationError) {
        console.error('Navigation failed:', navigationError);
        // If navigation fails, try with a more lenient approach
        await page.goto(url, {
          waitUntil: "load",
          timeout: 15000, // Reduced to 15 seconds
        });
      }

      // Wait for a REAL Rozetka selector to ensure the product page is actually ready
      await page.waitForSelector("h1, .product__title, .product-title", { timeout: 15000 }); // Reduced to 15 seconds

      console.log('Page loaded, waiting for content...');

      // Since we're blocking images and fonts, we don't need to wait for them to load
      // The page.waitForSelector already ensures the product content is available

      // Extract product information based on the site
      let productInfo = {};

      if (domain.includes('rozetka')) {
        console.log('Using Rozetka extractor');
        productInfo = await extractRozetkaInfo(page);
      } else if (domain.includes('prom')) {
        console.log('Using Prom.ua extractor');
        productInfo = await extractPromInfo(page);
      } else if (domain.includes('olx')) {
        console.log('Using OLX extractor');
        productInfo = await extractOlxInfo(page);
      } else if (domain.includes('amazon')) {
        console.log('Using Amazon extractor');
        productInfo = await extractAmazonInfo(page);
      } else if (domain.includes('ebay')) {
        console.log('Using eBay extractor');
        productInfo = await extractEbayInfo(page);
      } else if (domain.includes('bestbuy')) {
        console.log('Using BestBuy extractor');
        productInfo = await extractBestBuyInfo(page);
      } else if (domain.includes('target')) {
        console.log('Using Target extractor');
        productInfo = await extractTargetInfo(page);
      } else if (domain.includes('aliexpress')) {
        console.log('Using AliExpress extractor');
        productInfo = await extractAliexpressInfo(page);
      } else if (domain.includes('walmart')) {
        console.log('Using Walmart extractor');
        productInfo = await extractWalmartInfo(page);
      } else if (domain.includes('etsy')) {
        console.log('Using Etsy extractor');
        productInfo = await extractEtsyInfo(page);
      } else if (domain.includes('newegg')) {
        console.log('Using Newegg extractor');
        productInfo = await extractNeweggInfo(page);
      } else {
        console.log('Using generic extractor');
        // Generic extraction using Open Graph tags
        productInfo = await extractGenericInfo(page);
      }

      console.log('Extracted product info:', productInfo);

      // If we didn't get meaningful data, try generic extraction as fallback
      if (!productInfo.title || productInfo.title.includes(domain)) {
        console.log('Falling back to generic extraction');
        const genericInfo = await extractGenericInfo(page);
        if (genericInfo.title && !genericInfo.title.includes(domain)) {
          productInfo = {...productInfo, ...genericInfo};
        }
      }

      // If we still don't have meaningful data, try content-based extraction
      if (!productInfo.title || productInfo.title.includes(domain)) {
        console.log('Trying content-based extraction');
        const contentBasedInfo = await extractContentBasedInfo(page);
        if (contentBasedInfo.title && !contentBasedInfo.title.includes(domain)) {
          productInfo = {...productInfo, ...contentBasedInfo};
        }
      }

      return productInfo;
    } finally {
      // Close page first if it exists
      if (page) {
        try {
          await page.close();
        } catch (pageCloseError) {
          console.error('Error closing page:', pageCloseError);
        }
      }

      // Then close browser if it exists
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
    }
  })();

  try {
    // Race the extraction with a timeout
    const result = await Promise.race([extractionPromise, timeoutPromise]);
    return result;
  } catch (error) {
    if (error.message === 'Product extraction timed out after 20 seconds') {
      console.error('Product extraction timed out:', error);
      throw error;
    }

    console.error('Error extracting product info:', error);
    throw error;
  }
}

// Extract product info from Rozetka
async function extractRozetkaInfo(page) {
  // Try to get product title - multiple possible selectors
  let title = null;
  const titleSelectors = [
    'h1.product__heading',
    'h1.product-title__text',
    'h1[data-testid="product-title"]',
    'h1.product__title',
    'h1'
  ];

  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Wait a bit more for dynamic content to load, especially for price elements
  await page.waitForTimeout(2000);

  // Try to get price - multiple possible selectors (with Ukrainian/Russian price formats)
  let price = null;
  const priceSelectors = [
    '.product-price__big.text-2xl.font-bold',  // Specific selector for current price based on provided HTML
    '.product-price__small', // Previous price if available
    '.product-price__big',  // Alternative selector for main price
    '.product-price__wrap .product-price__big', // Price within the wrap div
    '.product-price__wrap .product-price__small', // Previous price within the wrap div
    '.product__price .price',
    '[data-testid="product-main-price"] .price__current',
    '.price_value',
    '.product-price-current',
    '.product-prices .product-price__current',
    '.main-product-price .price__current',
    '.product__price-format',
    '[data-testid="product-price"] .price__current',
    '.product-price .value',
    '.price-box .actual',
    '.current-price',
    '.price_current',
    '.product__price-default'
  ];

  for (const selector of priceSelectors) {
    try {
      // Wait for the element to be available
      await page.waitForSelector(selector, { timeout: 5000 });
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => {
          // Get the text content and clean it
          let text = el.textContent?.trim();
          // Remove extra whitespace and normalize spaces
          if (text) {
            text = text.replace(/\s+/g, ' ').trim();
            // Remove currency symbols but keep the numbers and spaces (for thousands separators)
            text = text.replace(/[^\d\s.,]/g, '').trim();
          }
          return text;
        }, element);

        if (price && price.length > 0) {
          // Clean up the price text to remove extra spaces and normalize
          price = price.replace(/\s+/g, ' ').trim();
          console.log(`Found price with selector "${selector}":`, price);
          break;
        }
      }
    } catch (e) {
      console.log(`Error with selector "${selector}":`, e.message);
      continue; // Try next selector
    }
  }

  // If we still don't have a price, try to find it in the entire document
  if (!price || price.length === 0) {
    console.log('No price found with specific selectors, trying document-wide search...');

    // Look for price patterns in the whole document
    try {
      // Get the full text content of the body
      const bodyHandle = await page.$('body');
      const bodyText = await page.evaluate(body => body.innerText, bodyHandle);

      const pricePatterns = [
        /(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)[\s\u00a0]?([\d\s.,]+)/i,
        /([\d\s.,]+)[\s\u00a0]?(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)/i,
        /цена[:\s]+([\d\s.,]+)/i,
        /price[:\s]+([\d\s.,]+)/i
      ];

      for (const pattern of pricePatterns) {
        const match = bodyText.match(pattern);
        if (match && match[1]) {
          price = match[1].replace(/[^\d\s.,]/g, '').trim(); // Clean the matched price
          console.log('Found price with pattern:', price);
          break;
        }
      }
    } catch (e) {
      console.log('Error in document-wide price search:', e.message);
    }
  }

  // If we still don't have a meaningful price, try alternative approaches
  if (!price || price.length === 0) {
    try {
      // Try to find elements that look like prices using attribute-based selectors
      const potentialPriceElements = await page.$$('.product-price *, [class*="price"] *, [class*="cost"] *, [class*="value"] *');

      for (const element of potentialPriceElements) {
        try {
          const text = await page.evaluate(el => el.textContent?.trim(), element);
          if (text && /\d/.test(text)) { // Contains at least one digit
            // Check if it looks like a price (contains numbers and possibly currency symbols)
            const cleanedText = text.replace(/[^\d\s.,]/g, '').trim();
            if (cleanedText && cleanedText.length > 1) { // At least 2 characters
              price = cleanedText;
              console.log('Found potential price in alternative search:', price);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      console.log('Error in alternative price search:', e.message);
    }
  }

  // Try to get main product image - focus on the most common selectors for main product images
  let image = null;
  const imageSelectors = [
    // Highest priority: First thumbnail image in Rozetka gallery (the one with "зображення 1")
    'rz-gallery-main-thumbnail-image button:first-child img',  // First thumbnail image
    'rz-gallery-main-thumbnail-image img:first-child',         // Alternative first thumbnail

    // Main content image (what's currently displayed)
    'rz-gallery-main-content-image img:first-child',           // Main content image

    // Based on recommended selectors
    'rz-gallery img:first-child',                              // Main gallery image
    'img[src*="content"]:first-child',                         // Images from content domain (main product images)

    // More specific selectors for Rozetka main image
    'rz-gallery-main-content-image img:nth-child(1)',          // Alternative for main image
    '.main-slider__item:first-child img',                      // First image in main slider
    '.main-slider__wrap:first-child img',                      // First image in main wrap

    // Rozetka specific selectors for main image (prioritizing primary image)
    'img[rzimage]:first-child',
    'img[ng-img="true"]:first-child',
    'img.photo-zoom__preview:first-child',
    'img.image-gallery__preview:first-child',
    'img.product-image__preview:first-child',
    '[data-testid="product-image"] img:first-child',
    'img.product-image__main:first-child',

    // General e-commerce selectors for main image
    'img.main-image:first-child',
    'img.product-image:first-child',
    'img.product-photo:first-child',
    'img.product-img:first-child',
    'img[itemprop="image"]:first-child',
    '#product-image img:first-child',
    '#main-image img:first-child',
    '.main-image img:first-child',

    // Secondary priority: Other product images (but still first in their container)
    '.product-photos img:first-child',
    '.product-gallery img:first-child',
    '.product-images img:first-child',

    // Prom.ua specific
    '.product-card-top__preview img:first-child',
    '.photo-wrap img:first-child',

    // OLX specific
    '.offer-photos-container img:first-child',
    '.gallery-item:first-child img',
    '.photo-slide:first-child img',

    // Fallback to any image that looks like a product image (first occurrence)
    'img[src*="product"]:first-child',
    'img[src*="image"]:first-child',
    'img[src*="photo"]:first-child',
    'img[src*="catalog"]:first-child',
    'img[src*="upload"]:first-child'
  ];

  console.log('Attempting to find main product image using selectors...');
  for (const selector of imageSelectors) {
    try {
      // Count how many images match this selector
      const elements = await page.$$(selector);
      console.log(`Selector "${selector}" found ${elements.length} image elements`);

      // Look for the first image that matches the selector (which will be the last due to :last-child)
      const element = await page.$(selector);
      if (element) {
        // Try multiple possible image URL sources, including Angular-specific attributes
        let imageUrl = await page.evaluate(el => {
          return el.src ||
                 el.dataset.src ||
                 el.getAttribute('data-lazy-src') ||
                 el.getAttribute('ng-src') ||
                 el.getAttribute('data-original') ||
                 el.getAttribute('data-ng-src');
        }, element);

        if (imageUrl) {
          console.log(`Found potential image URL:`, imageUrl);

          // Skip invalid image URLs
          if (imageUrl.startsWith('data:') ||
              imageUrl.includes('placeholder') ||
              imageUrl.includes('no-image') ||
              imageUrl.includes('svg') ||
              imageUrl.includes('blank')) {
            console.log('Skipping invalid image URL');
            continue;
          }

          // Make sure the image URL is absolute, not relative
          try {
            new URL(imageUrl);
          } catch (e) {
            // If it's a relative URL, convert to absolute using the page URL
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
              const pageUrl = page.url();
              const baseUrl = new URL(pageUrl).origin;
              imageUrl = baseUrl + imageUrl;
            }
          }

          // If we found a valid image URL, use it
          image = imageUrl;
          console.log('Selected image URL:', image);
          break; // Exit the selector loop once we find a valid image
        }
      }
    } catch (e) {
      console.log(`Error with selector "${selector}":`, e.message);
      continue; // Try next selector
    }
  }

  // Additional check: If we still don't have an image, try to get the first image from the main gallery area
  if (!image) {
    try {
      // Try to target the specific gallery area more directly
      // First try to get the first thumbnail image (the one with "зображення 1")
      const firstThumbnailImage = await page.$('rz-gallery-main-thumbnail-image button:first-child img');
      if (firstThumbnailImage) {
        let imageUrl = await page.evaluate(el => {
          return el.src ||
                 el.dataset.src ||
                 el.getAttribute('data-lazy-src') ||
                 el.getAttribute('ng-src') ||
                 el.getAttribute('data-original') ||
                 el.getAttribute('data-ng-src');
        }, firstThumbnailImage);

        if (imageUrl && !imageUrl.startsWith('data:') &&
            !imageUrl.includes('placeholder') &&
            !imageUrl.includes('no-image') &&
            !imageUrl.includes('svg') &&
            !imageUrl.includes('blank')) {

          // Make sure the image URL is absolute, not relative
          try {
            new URL(imageUrl);
          } catch (e) {
            // If it's a relative URL, convert to absolute using the page URL
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
              const pageUrl = page.url();
              const baseUrl = new URL(pageUrl).origin;
              imageUrl = baseUrl + imageUrl;
            }
          }

          image = imageUrl;
          console.log('Selected first thumbnail image URL:', image);
        }
      }

      // If the first thumbnail selector didn't work, try the main content image
      if (!image) {
        const mainContentImage = await page.$('rz-gallery-main-content-image img');
        if (mainContentImage) {
          let imageUrl = await page.evaluate(el => {
            return el.src ||
                   el.dataset.src ||
                   el.getAttribute('data-lazy-src') ||
                   el.getAttribute('ng-src') ||
                   el.getAttribute('data-original') ||
                   el.getAttribute('data-ng-src');
          }, mainContentImage);

          if (imageUrl && !imageUrl.startsWith('data:') &&
              !imageUrl.includes('placeholder') &&
              !imageUrl.includes('no-image') &&
              !imageUrl.includes('svg') &&
              !imageUrl.includes('blank')) {

            // Make sure the image URL is absolute, not relative
            try {
              new URL(imageUrl);
            } catch (e) {
              // If it's a relative URL, convert to absolute using the page URL
              if (imageUrl.startsWith('//')) {
                imageUrl = 'https:' + imageUrl;
              } else if (imageUrl.startsWith('/')) {
                const pageUrl = page.url();
                const baseUrl = new URL(pageUrl).origin;
                imageUrl = baseUrl + imageUrl;
              }
            }

            image = imageUrl;
            console.log('Selected main content image URL:', image);
          }
        }
      }

      // If the main gallery selectors didn't work, fall back to the original approach
      if (!image) {
        const gallerySelector = 'rz-gallery-main-content-image';

        // Get all images in the gallery and pick the first one
        const allGalleryImages = await page.$$(gallerySelector + ' img');
        console.log(`Gallery selector "${gallerySelector} img" found ${allGalleryImages.length} total images`);

        if (allGalleryImages && allGalleryImages.length > 0) {
          // Get the first image specifically
          const firstImage = allGalleryImages[0];
          let imageUrl = await page.evaluate(el => {
            return el.src ||
                   el.dataset.src ||
                   el.getAttribute('data-lazy-src') ||
                   el.getAttribute('ng-src') ||
                   el.getAttribute('data-original') ||
                   el.getAttribute('data-ng-src');
          }, firstImage);

          if (imageUrl) {
            // Skip invalid image URLs
            if (!imageUrl.startsWith('data:') &&
                !imageUrl.includes('placeholder') &&
                !imageUrl.includes('no-image') &&
                !imageUrl.includes('svg') &&
                !imageUrl.includes('blank')) {

              // Make sure the image URL is absolute, not relative
              try {
                new URL(imageUrl);
              } catch (e) {
                // If it's a relative URL, convert to absolute using the page URL
                if (imageUrl.startsWith('//')) {
                  imageUrl = 'https:' + imageUrl;
                } else if (imageUrl.startsWith('/')) {
                  const pageUrl = page.url();
                  const baseUrl = new URL(pageUrl).origin;
                  imageUrl = baseUrl + imageUrl;
                }
              }

              image = imageUrl;
              console.log('Selected first gallery image URL:', image);
            }
          }
        }
      }
    } catch (e) {
      console.log('Error getting first gallery image:', e.message);
    }
  }

  console.log('Rozetka extraction result - Title:', title, 'Price:', price, 'Image:', image);

  return {
    title: title,
    price: price,
    image: image
  };
}

// Extract product info from Prom.ua
async function extractPromInfo(page) {
  // Try to get product title - multiple possible selectors
  let title = null;
  const titleSelectors = [
    'h1[data-product-name]',
    'h1.title',
    'h1.product-title',
    'h1'
  ];

  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get price - multiple possible selectors (with Ukrainian/Russian price formats)
  let price = null;
  const priceSelectors = [
    '.price_value',
    '.product-price',
    '[data-diff] .price',
    '.price-current',
    '.current-price',
    '.product__price',
    '.product-price__value',
    '.price-block .price'
  ];

  for (const selector of priceSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => el.textContent?.trim(), element);
        if (price) {
          // Clean up the price text to remove extra spaces and newlines
          price = price.replace(/\s+/g, ' ').trim();
          break;
        }
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get image - multiple possible selectors
  let image = null;
  const imageSelectors = [
    '.product-card-top__preview img:first-child',
    '.photo-wrap img:first-child',
    'img[src*="image"]:first-child',
    '.product-image img:first-child',
    '.gallery-preview img:first-child',
    'img.main-photo:first-child'
  ];

  for (const selector of imageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        image = await page.evaluate(el => el.src, element);
        if (image) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  return {
    title: title,
    price: price,
    image: image
  };
}

// Extract product info from OLX
async function extractOlxInfo(page) {
  // Try to get product title - multiple possible selectors
  let title = null;
  const titleSelectors = [
    'h1[data-testid="ad_title"]',
    'h1.clr',
    'h1.offer-title',
    'h1',
    '.offer-title h1'
  ];

  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get price - multiple possible selectors (with Ukrainian/Russian price formats)
  let price = null;
  const priceSelectors = [
    'h3[data-testid="ad-price"]',
    '.price-label',
    '.xxxx-large',
    '.price-value',
    '.offer-price__number',
    '.price__value',
    '[data-testid="ad-price"]',
    '.price-box .price'
  ];

  for (const selector of priceSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => el.textContent?.trim(), element);
        if (price) {
          // Clean up the price text to remove extra spaces and newlines
          price = price.replace(/\s+/g, ' ').trim();
          break;
        }
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get image - multiple possible selectors
  let image = null;
  const imageSelectors = [
    'img[data-testid="swiper-slide"]:first-child',
    '.photo-container img:first-child',
    'img[src*="image"]:first-child',
    '.offer-photos-container img:first-child',
    '.gallery-item img:first-child',
    'img.main-photo:first-child'
  ];

  for (const selector of imageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        image = await page.evaluate(el => el.src, element);
        if (image) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  return {
    title: title,
    price: price,
    image: image
  };
}

// Extract product info from Amazon
async function extractAmazonInfo(page) {
  // Try to get product title
  let title = null;
  const titleSelectors = ['#productTitle', '#title', 'h1[data-a-size="large"]'];
  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get price
  let price = null;
  const priceSelectors = ['#priceblock_ourprice', '#priceblock_dealprice', '.a-price .a-offscreen', '#tp_price_block_ourprice_sims_feature_div'];
  for (const selector of priceSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => el.textContent?.trim(), element);
        if (price) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get image
  let image = null;
  const imageSelectors = ['#landingImage', '#imgBlkFront', '#altImages img:first-child', '#imageBlock img:first-child'];
  for (const selector of imageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        image = await page.evaluate(el => el.src, element);
        if (image) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  return {
    title: title,
    price: price,
    image: image
  };
}

// Extract product info from eBay
async function extractEbayInfo(page) {
  // Try to get product title
  let title = null;
  const titleSelectors = ['#CenterPanelInternal h1', 'h1#vi-lkhdr-itmTitl', 'h1.x-item-title__mainTitle'];
  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get price
  let price = null;
  const priceSelectors = ['.notranslate.x-price-primary', '#prcIsum', '.x-price-primary'];
  for (const selector of priceSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => el.textContent?.trim(), element);
        if (price) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get image
  let image = null;
  const imageSelectors = ['#icImg', '#mainImgHldr', '.ux-image-carousel-item img:first-child', 'img#icImg'];
  for (const selector of imageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        image = await page.evaluate(el => el.src, element);
        if (image) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  return {
    title: title,
    price: price,
    image: image
  };
}

// Extract product info from Best Buy
async function extractBestBuyInfo(page) {
  // Try to get product title
  let title = null;
  const titleSelectors = ['h1.heading-5', 'h1.product-name', 'h1[data-test="product-title"]'];
  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get price
  let price = null;
  const priceSelectors = ['.priceView-hero-price .price', '[data-test="product-price-current"]', '.sr-only'];
  for (const selector of priceSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => el.textContent?.trim(), element);
        if (price) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get image
  let image = null;
  const imageSelectors = ['img.primary-image:first-child', 'img[data-test="primary-hero-image"]:first-child', 'img.zoom-image:first-child'];
  for (const selector of imageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        image = await page.evaluate(el => el.src, element);
        if (image) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  return {
    title: title,
    price: price,
    image: image
  };
}

// Extract product info from Target
async function extractTargetInfo(page) {
  // Try to get product title
  let title = null;
  const titleSelectors = ['h1[data-test="product-title"]', 'h1.test@product.title', 'h1'];
  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get price
  let price = null;
  const priceSelectors = ['[data-test="product-price"]', '.price', '[data-test="current-price"]'];
  for (const selector of priceSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => el.textContent?.trim(), element);
        if (price) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get image
  let image = null;
  const imageSelectors = ['img[data-test="image"]:first-child', 'img.ProductImage-module__image___3oCZv:first-child', 'img:first-child'];
  for (const selector of imageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        image = await page.evaluate(el => el.src, element);
        if (image) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  return {
    title: title,
    price: price,
    image: image
  };
}

// Extract product info from AliExpress
async function extractAliexpressInfo(page) {
  // Try to get product title
  let title = null;
  const titleSelectors = ['h1.product-title', 'h1[data-spm="productTitle"]', '.product-title-text'];
  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get price
  let price = null;
  const priceSelectors = ['.uniform-banner-box-price', '.product-price-value', '[data-spm="price"]'];
  for (const selector of priceSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => el.textContent?.trim(), element);
        if (price) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get image
  let image = null;
  const imageSelectors = ['#imgExchange img:first-child', '.magnifier-handle:first-child', 'img#characteristic-img-0'];
  for (const selector of imageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        image = await page.evaluate(el => el.src, element);
        if (image) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  return {
    title: title,
    price: price,
    image: image
  };
}

// Extract product info from Walmart
async function extractWalmartInfo(page) {
  // Try to get product title
  let title = null;
  const titleSelectors = ['h1[data-testid="product-title"]', 'h1.prod-ProductTitle', 'h1'];
  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get price
  let price = null;
  const priceSelectors = ['span[data-testid="price-current"]', '[itemprop="price"]', '.price-current'];
  for (const selector of priceSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => el.textContent?.trim(), element);
        if (price) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get image
  let image = null;
  const imageSelectors = ['img[data-testid="product-image"]:first-child', 'img.prod-ProductImage:first-child', 'img:first-child'];
  for (const selector of imageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        image = await page.evaluate(el => el.src, element);
        if (image) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  return {
    title: title,
    price: price,
    image: image
  };
}

// Extract product info from Etsy
async function extractEtsyInfo(page) {
  // Try to get product title
  let title = null;
  const titleSelectors = ['h1[data-listing-id]', 'h1.v2-listing-title'];
  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get price
  let price = null;
  const priceSelectors = ['.wt-text-title-03', '.currency-value'];
  for (const selector of priceSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => el.textContent?.trim(), element);
        if (price) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get image
  let image = null;
  const imageSelectors = ['img[data-listing-image]:first-child'];
  for (const selector of imageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        image = await page.evaluate(el => el.src, element);
        if (image) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  return {
    title: title,
    price: price,
    image: image
  };
}

// Extract product info from Newegg
async function extractNeweggInfo(page) {
  // Try to get product title
  let title = null;
  const titleSelectors = ['#grpDescrip_h1', 'h1'];
  for (const selector of titleSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        title = await page.evaluate(el => el.textContent?.trim(), element);
        if (title) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get price
  let price = null;
  const priceSelectors = ['.price-current', '.grpRichText', '[data-testid="product-price-current"]'];
  for (const selector of priceSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        price = await page.evaluate(el => el.textContent?.trim(), element);
        if (price) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Try to get image
  let image = null;
  const imageSelectors = ['#landingImage', 'img.master-image:first-child'];
  for (const selector of imageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        image = await page.evaluate(el => el.src, element);
        if (image) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  return {
    title: title,
    price: price,
    image: image
  };
}

// Generic extraction using Open Graph tags and other meta information
async function extractGenericInfo(page) {
  // Try to get Open Graph tags
  let ogTitle = null;
  const titleMetaSelectors = [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[property="og:site_name"]'
  ];

  for (const selector of titleMetaSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        ogTitle = await page.evaluate(el => el.content, element);
        if (ogTitle) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // Look for price in various formats
  let ogPrice = null;
  const priceMetaSelectors = [
    'meta[property="product:price:amount"]',
    'meta[name="twitter:data1"]',
    'meta[name="twitter:data2"]',
    'meta[itemprop="price"]'
  ];

  for (const selector of priceMetaSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        ogPrice = await page.evaluate(el => el.content, element);
        if (ogPrice) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  let ogImage = null;
  const imageMetaSelectors = [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'link[rel="image_src"]'
  ];

  for (const selector of imageMetaSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        ogImage = await page.evaluate(el => el.content || el.href, element);
        if (ogImage) break;
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // If no og:image found, try to find the main product image on the page
  if (!ogImage) {
    console.log('No og:image found, looking for main product image on page...');

    try {
      // Try to find the main product image first using common selectors
      const mainImageSelectors = [
        'img[itemprop="image"]:first-child',
        '#main-image img:first-child',
        '#product-image img:first-child',
        '.main-image img:first-child',
        '.product-image img:first-child',
        '.product-photo img:first-child',
        '.product-img:first-child',
        '[data-testid="product-image"] img:first-child',
        'img[data-main-image]:first-child',
        'img[data-role="main-image"]:first-child'
      ];

      for (const selector of mainImageSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const src = await page.evaluate(el => el.src || el.dataset.src, element);
            if (src && !src.startsWith('data:') && !src.includes('placeholder') && !src.includes('svg')) {
              ogImage = src;
              console.log('Selected main product image:', ogImage);
              break;
            }
          }
        } catch (e) {
          continue; // Try next selector
        }
      }

      // If still no main image found, try to find the largest image
      if (!ogImage) {
        const images = await page.$$('img');
        console.log(`Found ${images.length} images on the page`);

        // Filter out tiny images and find the largest one
        const validImages = [];
        for (const img of images) {
          try {
            const src = await page.evaluate(el => el.src || el.dataset.src, img);

            // Check if image has a valid src
            if (src && !src.startsWith('data:') && !src.includes('placeholder') && !src.includes('svg')) {
              const boundingBox = await img.boundingBox();
              if (boundingBox && boundingBox.width > 50 && boundingBox.height > 50) {
                validImages.push({ element: img, src, width: boundingBox.width, height: boundingBox.height });
              }
            }
          } catch (e) {
            continue; // Skip if there's an error processing this image
          }
        }

        console.log(`Found ${validImages.length} valid images after filtering`);

        if (validImages.length > 0) {
          // Find the largest image
          const largestImage = validImages.reduce((prev, current) =>
            (current.width * current.height) > (prev.width * prev.height) ? current : prev
          );

          if (largestImage) {
            ogImage = largestImage.src;
            console.log('Selected largest image:', ogImage);
          }
        }
      }
    } catch (e) {
      console.log('Error finding main product image:', e);
    }
  }

  // Also try to get the document title as fallback
  let docTitle = null;
  try {
    docTitle = await page.title();
  } catch (e) {
    console.log('Could not get page title:', e);
  }

  // Try to find price in the page content (for when sites don't use meta tags properly)
  let priceInText = null;
  try {
    const allText = await page.textContent('body');
    const pricePattern = /(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)[\s\u00a0]?([\d\s.,]+)/i;
    const match = allText.match(pricePattern);
    if (match) {
      priceInText = match[1];
    }
  } catch (e) {
    console.log('Error finding price in text:', e);
  }

  // Make sure the image URL is absolute
  if (ogImage) {
    try {
      new URL(ogImage);
    } catch (e) {
      // If it's a relative URL, convert to absolute
      if (ogImage.startsWith('//')) {
        ogImage = 'https:' + ogImage;
      } else if (ogImage.startsWith('/')) {
        const pageUrl = page.url();
        const baseUrl = new URL(pageUrl).origin;
        ogImage = baseUrl + ogImage;
      }
    }
  }

  return {
    title: ogTitle ? ogTitle.trim() : (docTitle && !docTitle.includes('moment') ? docTitle.trim() : null),
    price: ogPrice ? ogPrice.trim() : priceInText,
    image: ogImage
  };
}

// Content-based extraction for when other methods fail
async function extractContentBasedInfo(page) {
  // Try to find product title in various common patterns
  let title = null;

  // Look for headings that might contain product names
  const headingSelectors = ['h1', 'h2', 'h3', '.title', '.name', '.product-title', '.product-name'];
  for (const selector of headingSelectors) {
    try {
      const elements = await page.$$(selector);
      for (const element of elements) {
        const text = await page.evaluate(el => el.textContent?.trim(), element);
        // Skip if text is too short or contains common non-product words
        if (text && text.length > 5 &&
            !text.toLowerCase().includes('cart') &&
            !text.toLowerCase().includes('checkout') &&
            !text.toLowerCase().includes('login') &&
            !text.toLowerCase().includes('register') &&
            !text.toLowerCase().includes('category') &&
            !text.toLowerCase().includes('home')) {
          title = text;
          break;
        }
      }
      if (title) break;
    } catch (e) {
      continue; // Try next selector
    }
  }

  // If no title found in headings, try to get from document title
  if (!title) {
    try {
      title = await page.title();
      // Remove common site name patterns
      if (title) {
        title = title.replace(/[-_]\s*(.*)$/, '').trim();
      }
    } catch (e) {
      console.log('Could not get page title:', e);
    }
  }

  // Try to find price in various formats
  let price = null;
  try {
    const allText = await page.textContent('body');
    const pricePatterns = [
      /(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)[\s\u00a0]?([\d\s.,]+)/i,
      /([\d\s.,]+)[\s\u00a0]?(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)/i,
      /цена[:\s]+([\d\s.,]+)/i,
      /price[:\s]+([\d\s.,]+)/i,
      /від\s+([\d\s.,]+)/i,  // "from" in Ukrainian
      /від\s+.*?([\d\s.,]+)/i
    ];

    for (const pattern of pricePatterns) {
      const match = allText.match(pattern);
      if (match) {
        price = match[1].trim();
        break;
      }
    }
  } catch (e) {
    console.log('Error finding price in text:', e);
  }

  // If no price found in text, try to find in elements with price-related classes
  if (!price) {
    const priceSelectors = ['.price', '.cost', '.amount', '[class*="price"]', '[class*="cost"]'];
    for (const selector of priceSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await page.evaluate(el => el.textContent?.trim(), element);
          if (text) {
            const priceMatch = text.match(/[\d\s.,]+/);
            if (priceMatch) {
              price = priceMatch[0].trim();
              break;
            }
          }
        }
        if (price) break;
      } catch (e) {
        continue; // Try next selector
      }
    }
  }

  // Try to find main product image
  let image = null;

  // Look for main product image first using specific selectors
  const mainImageSelectors = [
    'img[itemprop="image"]:first-child',
    '#main-image img:first-child',
    '#product-image img:first-child',
    '.main-image img:first-child',
    '.product-image img:first-child',
    '.product-photo img:first-child',
    '.product-img:first-child',
    '[data-testid="product-image"] img:first-child',
    'img[data-main-image]:first-child',
    'img[data-role="main-image"]:first-child'
  ];

  // Try main image selectors first
  for (const selector of mainImageSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const src = await page.evaluate(el => el.src || el.dataset.src, element);
        if (src && !src.startsWith('data:') && !src.includes('placeholder') && !src.includes('svg')) {
          image = src;
          console.log('Selected main product image:', image);
          break;
        }
      }
    } catch (e) {
      continue; // Try next selector
    }
  }

  // If no main image found, look for images near product title or price elements
  if (!image) {
    const productAreaSelectors = ['h1', '.product', '.item', '.product-card', '.product-detail'];
    let productAreaFound = false;

    for (const selector of productAreaSelectors) {
      try {
        const productArea = await page.$(selector);
        if (productArea) {
          const imagesInArea = await page.$$(selector + ' img:first-child'); // Only get first image
          // Find the largest image in the product area
          let largestImageSize = 0;
          for (const img of imagesInArea) {
            try {
              const src = await page.evaluate(el => el.src || el.dataset.src, img);
              const boundingBox = await img.boundingBox();

              if (boundingBox && boundingBox.width > 50 && boundingBox.height > 50) {
                // Skip placeholder images
                if (src && !src.includes('placeholder') && !src.includes('no-image') && !src.startsWith('data:')) {
                  image = src;
                  largestImageSize = boundingBox.width * boundingBox.height;
                  productAreaFound = true;
                  break;
                }
              }
            } catch (e) {
              continue; // Skip if there's an error processing this image
            }
          }
          if (image) break;
        }
      } catch (e) {
        continue; // Try next selector
      }
    }
  }

  // If no image found in product area, find the largest image on the page
  if (!image) {
    try {
      const allImages = await page.$$('img');
      let largestSize = 0;
      for (const img of allImages) {
        try {
          const src = await page.evaluate(el => el.src || el.dataset.src, img);
          const boundingBox = await img.boundingBox();

          if (boundingBox && boundingBox.width > 100 && boundingBox.height > 100) {
            if (src && !src.includes('placeholder') && !src.includes('no-image') && !src.startsWith('data:')) {
              const size = boundingBox.width * boundingBox.height;
              if (size > largestSize) {
                image = src;
                largestSize = size;
              }
            }
          }
        } catch (e) {
          continue; // Skip if there's an error processing this image
        }
      }
    } catch (e) {
      console.log('Error finding images on page:', e);
    }
  }

  // Make sure the image URL is absolute
  if (image) {
    try {
      new URL(image);
    } catch (e) {
      // If it's a relative URL, convert to absolute
      if (image.startsWith('//')) {
        image = 'https:' + image;
      } else if (image.startsWith('/')) {
        const pageUrl = page.url();
        const baseUrl = new URL(pageUrl).origin;
        image = baseUrl + image;
      }
    }
  }

  return {
    title: title || null,
    price: price || null,
    image: image
  };
}

// API endpoint to extract product info
app.post('/api/extract-product-info', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (urlError) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const productInfo = await extractProductInfo(url);

    res.json({
      success: true,
      data: productInfo
    });
  } catch (error) {
    console.error('API Error:', error);

    // Handle timeout errors specifically
    if (error.message && error.message.includes('timed out')) {
      res.status(408).json({
        success: false,
        error: 'Product extraction timed out. The website took too long to respond.'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to extract product information'
      });
    }
  }
});

// API endpoint to create a new wishlist
app.post('/api/lists', async (req, res) => {
  try {
    const { title, description, creatorName, creatorEmail } = req.body;

    // Create or find the creator (only by name as per requirements)
    let creator = await db.Creator.findOne({ where: { name: creatorName } });
    if (!creator) {
      creator = await db.Creator.create({
        name: creatorName
        // No email as per requirements
      });
    }

    // Generate a unique numeric share token
    const shareToken = Math.floor(1000000000000 + Math.random() * 9000000000000).toString(); // Generate a 13-digit numeric token

    // Create the list
    const newList = await db.List.create({
      title,
      description,
      creatorId: creator.id,
      shareToken
    });

    res.json({
      id: newList.id,
      title: newList.title,
      description: newList.description,
      creatorId: newList.creatorId,
      shareToken: newList.shareToken,
      shareableLink: `${req.protocol}://${req.get('host')}/lists/${newList.shareToken}/check`,
      message: 'List created successfully'
    });
  } catch (error) {
    console.error('Error creating list:', error);
    res.status(500).json({
      error: error.message || 'Failed to create wishlist'
    });
  }
});

// API endpoint to get a list by share token
app.get('/api/lists/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const list = await db.List.findOne({
      where: { shareToken: token },
      include: [
        {
          model: db.Creator,
          as: 'creator',
          attributes: ['name'] // Only name as per requirements
        },
        {
          model: db.Goods,
          as: 'goods',
          include: [{
            model: db.Guest,
            as: 'reservedByGuest',
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    res.json(list);
  } catch (error) {
    console.error('Error getting list:', error);
    res.status(500).json({
      error: error.message || 'Failed to retrieve wishlist'
    });
  }
});

// API endpoint to add a product to a wishlist
app.post('/api/goods', async (req, res) => {
  try {
    const { listId, url, name, price, imageUrl } = req.body;

    let productInfo = {};

    // If URL is provided, extract product info from it
    if (url && url.trim() !== '') {
      productInfo = await extractProductInfo(url);
    } else {
      // If no URL, use the provided manual data
      productInfo = {
        title: name || 'Manual Entry Product',
        price: price || null,
        image: imageUrl || null
      };
    }

    // Create the good
    let priceValue = null;
    if (productInfo.price) {
      // Clean the price string and convert to number with better international support
      let cleanPrice = productInfo.price.toString();

      // Handle various international price formats
      // Remove currency symbols and other non-numeric characters except decimal markers
      cleanPrice = cleanPrice.replace(/[^\d.,\s]/g, '');

      // Handle different decimal/thousands separators based on common patterns
      // If there are multiple commas and only one dot, commas are likely thousands separators
      const commaCount = (cleanPrice.match(/,/g) || []).length;
      const dotCount = (cleanPrice.match(/\./g) || []).length;

      if (commaCount > 1 && dotCount <= 1) {
        // Commas are thousands separators, remove them
        cleanPrice = cleanPrice.replace(/,/g, '');
      } else if (commaCount === 1 && dotCount === 0) {
        // Comma is decimal separator, replace with dot
        cleanPrice = cleanPrice.replace(/,/g, '.');
      } else if (commaCount > 1 && dotCount === 1) {
        // If dot comes after commas, it's decimal separator, remove commas
        // If dot comes before commas, comma might be decimal separator
        const dotIndex = cleanPrice.lastIndexOf('.');
        const commaIndex = cleanPrice.lastIndexOf(',');
        if (commaIndex > dotIndex) {
          // Last comma comes after last dot, treat comma as decimal separator
          cleanPrice = cleanPrice.replace(/\./g, ''); // Remove dots (thousands)
          cleanPrice = cleanPrice.replace(/,/g, '.'); // Replace last comma with dot
        } else {
          // Dot is decimal separator, remove commas
          cleanPrice = cleanPrice.replace(/,/g, '');
        }
      }

      // Remove spaces (common in European formats)
      cleanPrice = cleanPrice.replace(/\s/g, '');

      // Extract the numeric value
      const priceMatch = cleanPrice.match(/[\d.]+/);
      if (priceMatch) {
        priceValue = parseFloat(priceMatch[0]) || null;
      }
    }

    const newGood = await db.Goods.create({
      name: productInfo.title || name || 'Unknown Product',
      description: '',
      price: priceValue,
      imageUrl: productInfo.image || imageUrl || null,
      url: url || '',
      listId
    });

    res.json({
      id: newGood.id,
      name: newGood.name,
      description: newGood.description,
      price: newGood.price,
      imageUrl: newGood.imageUrl,
      url: newGood.url,
      listId: newGood.listId,
      message: 'Product added to wishlist successfully'
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({
      error: error.message || 'Failed to add product to wishlist'
    });
  }
});

// API endpoint to reserve a product
app.put('/api/goods/:id/reserve', async (req, res) => {
  try {
    const { id } = req.params;
    const { guestName, guestEmail } = req.body;

    // Find or create the guest
    let guest = await db.Guest.findOne({ where: { name: guestName } }); // Only search by name as per requirements
    if (!guest) {
      guest = await db.Guest.create({
        name: guestName
        // No email as per requirements
      });
    }

    // Update the good with reservation info
    const good = await db.Goods.findByPk(id);
    if (!good) {
      return res.status(404).json({ error: 'Product not found' });
    }

    good.reservedBy = guest.id;
    good.reservationDate = new Date();
    await good.save();

    // Reload with guest info
    await good.reload({
      include: [{
        model: db.Guest,
        as: 'reservedByGuest',
        attributes: ['id', 'name']
      }]
    });

    res.json({
      id: good.id,
      name: good.name,
      reservedByGuest: good.reservedByGuest,
      reservationDate: good.reservationDate,
      message: 'Product reserved successfully'
    });
  } catch (error) {
    console.error('Error reserving product:', error);
    res.status(500).json({
      error: error.message || 'Failed to reserve product'
    });
  }
});

// API endpoint to unreserve a product
app.delete('/api/goods/:id/reserve', async (req, res) => {
  try {
    const { id } = req.params;

    const good = await db.Goods.findByPk(id);
    if (!good) {
      return res.status(404).json({ error: 'Product not found' });
    }

    good.reservedBy = null;
    good.reservationDate = null;
    await good.save();

    res.json({
      id: good.id,
      name: good.name,
      message: 'Product reservation removed successfully'
    });
  } catch (error) {
    console.error('Error unreserving product:', error);
    res.status(500).json({
      error: error.message || 'Failed to remove reservation'
    });
  }
});

// API endpoint to delete a good
app.delete('/api/goods/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const good = await db.Goods.findByPk(id);
    if (!good) {
      return res.status(404).json({ error: 'Good not found' });
    }

    await good.destroy();

    res.json({ message: 'Good deleted successfully' });
  } catch (error) {
    console.error('Error deleting good:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete good'
    });
  }
});

// API endpoint to get list statistics
app.get('/api/lists/:token/stats', async (req, res) => {
  try {
    const { token } = req.params;

    const list = await db.List.findOne({ where: { shareToken: token } });
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Get all goods for this list
    const goods = await db.Goods.findAll({ where: { listId: list.id } });

    const totalItems = goods.length;
    const reservedItems = goods.filter(good => good.reservedBy !== null).length;
    const availableItems = totalItems - reservedItems;

    // Calculate total budget (only count items with prices)
    let totalBudget = 0;
    goods.forEach(good => {
      if (good.price) {
        // Parse price string to number (remove currency symbols, commas, etc.)
        const priceStr = good.price.toString().replace(/[^\d.,]/g, '');
        const priceNum = parseFloat(priceStr.replace(',', ''));
        if (!isNaN(priceNum)) {
          totalBudget += priceNum;
        }
      }
    });

    // Get reservation counts by guest
    const reservations = {};
    for (const good of goods) {
      if (good.reservedBy) {
        const guest = await db.Guest.findByPk(good.reservedBy);
        if (guest) {
          if (!reservations[guest.name]) {
            reservations[guest.name] = 0;
          }
          reservations[guest.name]++;
        }
      }
    }

    const reservationsArray = Object.entries(reservations).map(([name, count]) => ({
      guestName: name,
      reservedCount: count
    }));

    res.json({
      totalItems,
      reservedItems,
      availableItems,
      totalBudget: totalBudget.toFixed(2),
      reservations: reservationsArray
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: error.message || 'Failed to retrieve statistics'
    });
  }
});

// Serve the lists page (creation page)
app.get('/lists', (req, res) => {
  res.sendFile(path.join(__dirname, './client/index.html'));
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './client/index.html'));
});

// Serve wishlist page by share token (numeric) - for guests
app.get('/lists/:listId/check', async (req, res) => {
  try {
    const { listId } = req.params;

    // Find the list by share token
    const list = await db.List.findOne({
      where: { shareToken: listId },
      include: [
        {
          model: db.Creator,
          as: 'creator',
          attributes: ['name']
        },
        {
          model: db.Goods,
          as: 'goods',
          include: [{
            model: db.Guest,
            as: 'reservedByGuest',
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    if (!list) {
      return res.status(404).send('Wishlist not found');
    }

    // Pass the list info to the client via template variables or query params
    // For now, we'll just serve the same HTML but the client will handle the view mode
    res.sendFile(path.join(__dirname, './client/index.html'));
  } catch (error) {
    console.error('Error retrieving wishlist:', error);
    res.status(500).send('Error retrieving wishlist');
  }
});

// API endpoint to delete a wishlist
app.delete('/api/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find the list by ID
    const list = await db.List.findByPk(id);

    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Delete all goods associated with this list first (due to foreign key constraints)
    await db.Goods.destroy({
      where: { listId: id }
    });

    // Delete the list
    await list.destroy();

    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    console.error('Error deleting list:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete wishlist'
    });
  }
});

// Serve wishlist page by share token (numeric) - for creators
app.get('/lists/:listId', async (req, res) => {
  try {
    const { listId } = req.params;

    // Find the list by share token
    const list = await db.List.findOne({
      where: { shareToken: listId },
      include: [
        {
          model: db.Creator,
          as: 'creator',
          attributes: ['name']
        },
        {
          model: db.Goods,
          as: 'goods',
          include: [{
            model: db.Guest,
            as: 'reservedByGuest',
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    if (!list) {
      return res.status(404).send('Wishlist not found');
    }

    // Pass the list info to the client via template variables or query params
    // For now, we'll just serve the same HTML but the client will handle the view mode
    res.sendFile(path.join(__dirname, './client/index.html'));
  } catch (error) {
    console.error('Error retrieving wishlist:', error);
    res.status(500).send('Error retrieving wishlist');
  }
});

// Serve wishlist page by share token (numeric) - legacy route
app.get('/wishlist/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find the list by share token
    const list = await db.List.findOne({
      where: { shareToken: token },
      include: [
        {
          model: db.Creator,
          as: 'creator',
          attributes: ['name']
        },
        {
          model: db.Goods,
          as: 'goods',
          include: [{
            model: db.Guest,
            as: 'reservedByGuest',
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    if (!list) {
      return res.status(404).send('Wishlist not found');
    }

    // Pass the list info to the client via template variables or query params
    // For now, we'll just serve the same HTML but the client will handle the view mode
    res.sendFile(path.join(__dirname, './client/index.html'));
  } catch (error) {
    console.error('Error retrieving wishlist:', error);
    res.status(500).send('Error retrieving wishlist');
  }
});

// API endpoint to get all supported domains
app.get('/api/domains', (req, res) => {
  res.json({ domains: SUPPORTED_DOMAINS });
});

// Synchronize database models
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync models with database
    await sequelize.sync({ alter: false }); // Set to true if you want to update tables
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1); // Exit the process if database connection fails
  }
}

// Function to get local IP address
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();

  for (const interfaceName in interfaces) {
    const interface = interfaces[interfaceName];
    for (const iface of interface) {
      // Skip over internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }

  // If no external IP found, return localhost
  return 'localhost';
}

// Start server after initializing database
initializeDatabase().then(() => {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the application from other devices using: http://${getLocalIP()}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Supported domains: ${SUPPORTED_DOMAINS.join(', ')}`);
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
    });
  });
}).catch(error => {
  console.error('Failed to start server due to database error:', error);
  process.exit(1);
});

// Function to get local IP address
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();

  for (const interfaceName in interfaces) {
    const interface = interfaces[interfaceName];
    for (const iface of interface) {
      // Skip over internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }

  // If no external IP found, return localhost
  return 'localhost';
}

module.exports = app;