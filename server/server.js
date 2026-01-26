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

  // Try to get price - multiple possible selectors (with Ukrainian/Russian price formats)
  let price = null;
  const priceSelectors = [
    '.product-price__big .product-price__sum',
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

  // If we still don't have a price, try to find it in the entire document
  if (!price) {
    // Look for price patterns in the whole document
    try {
      const bodyText = await page.textContent('body');
      const pricePatterns = [
        /(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)[\s\u00a0]?([\d\s.,]+)/i,
        /([\d\s.,]+)[\s\u00a0]?(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)/i,
        /цена[:\s]+([\d\s.,]+)/i,
        /price[:\s]+([\d\s.,]+)/i
      ];

      for (const pattern of pricePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          price = match[1].trim();
          break;
        }
      }
    } catch (e) {
      // Ignore error and continue
    }
  }

  // Try to get main product image - focus on the most common selectors for main product images
  let image = null;
  const imageSelectors = [
    // Main product image in slider/gallery area (based on the structure you provided)
    'rz-gallery-main-content-image img',
    '.main-slider__item img',
    '.main-slider__wrap img',

    // Rozetka specific selectors (including Angular-specific attributes)
    'img[rzimage]',
    'img[ng-img="true"]',
    'img.photo-zoom__preview',
    'img.image-gallery__preview',
    'img.product-image__preview',
    '[data-testid="product-image"] img',
    'img.product-image__main',

    // General e-commerce selectors
    'img.main-image',
    'img.product-image',
    'img.product-photo',
    'img.product-img',
    'img[itemprop="image"]',
    '#product-image img',
    '#main-image img',
    '.main-image img',
    '.product-image img',
    '.product-photos img',
    '.product-gallery img',
    '.product-images img',

    // Prom.ua specific
    '.product-card-top__preview img',
    '.photo-wrap img',

    // OLX specific
    '.offer-photos-container img',
    '.gallery-item img',
    '.photo-slide img',

    // Fallback to any image that looks like a product image
    'img[src*="product"]',
    'img[src*="image"]',
    'img[src*="photo"]',
    'img[src*="catalog"]',
    'img[src*="upload"]'
  ];

  console.log('Attempting to find main product image using selectors...');
  for (const selector of imageSelectors) {
    try {
      const elements = await page.$$(selector);
      console.log(`Selector "${selector}" found ${elements.length} elements`);

      for (const element of elements) {
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
          break;
        }
      }

      if (image) {
        break; // Found an image, exit the outer loop too
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
    '.product-card-top__preview img',
    '.photo-wrap img',
    'img[src*="image"]',
    '.product-image img',
    '.gallery-preview img',
    'img.main-photo'
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
    'img[data-testid="swiper-slide"]',
    '.photo-container img',
    'img[src*="image"]',
    '.offer-photos-container img',
    '.gallery-item img',
    'img.main-photo'
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
  const imageSelectors = ['#landingImage', '#imgBlkFront', '#altImages img', '#imageBlock img'];
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
  const imageSelectors = ['#icImg', '#mainImgHldr', '.ux-image-carousel-item img', 'img#icImg'];
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
  const imageSelectors = ['img.primary-image', 'img[data-test="primary-hero-image"]', 'img.zoom-image'];
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
  const imageSelectors = ['img[data-test="image"]', 'img.ProductImage-module__image___3oCZv', 'img'];
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
  const imageSelectors = ['#imgExchange img', '.magnifier-handle', 'img#characteristic-img-0'];
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
  const imageSelectors = ['img[data-testid="product-image"]', 'img.prod-ProductImage', 'img'];
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
  const imageSelectors = ['img[data-listing-image]'];
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
  const imageSelectors = ['#landingImage', 'img.master-image'];
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

  // If no og:image found, try to find the largest image on the page
  if (!ogImage) {
    console.log('No og:image found, looking for largest image on page...');

    try {
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
    } catch (e) {
      console.log('Error finding largest image:', e);
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

  // Look for images near product title or price elements
  const productAreaSelectors = ['h1', '.product', '.item', '.product-card', '.product-detail'];
  let productAreaFound = false;

  for (const selector of productAreaSelectors) {
    try {
      const productArea = await page.$(selector);
      if (productArea) {
        const imagesInArea = await page.$$(selector + ' img');
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
      // Clean the price string and convert to number
      const cleanPrice = productInfo.price.toString().replace(/[^\d.,]/g, '');
      if (cleanPrice && cleanPrice.trim() !== '') {
        priceValue = parseFloat(cleanPrice.replace(',', '')) || null;
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

// Start server after initializing database
initializeDatabase().then(() => {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
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

module.exports = app;