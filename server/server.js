const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Load environment variables

const { sequelize } = require('./database/db'); // Import database connection
const db = require('./models'); // Import all models

const app = express();
const PORT = process.env.PORT || 3000; // Changed back to port 3000

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client'))); // Serve static files from the client directory

// Supported domains
const SUPPORTED_DOMAINS = [
  'rozetka.com.ua',
  'prom.ua',
  'olx.ua',
  'amazon.com',
  'ebay.com',
  'bestbuy.com',
  'target.com',
  'aliexpress.com'
];

// Function to extract product info from a URL
async function extractProductInfo(url) {
  let browser;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Product extraction timed out after 20 seconds')), 20000)
  );

  // Main extraction logic wrapped in a promise for timeout
  const extractionPromise = (async () => {
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

      // Launch browser with optimized options for speed
      browser = await puppeteer.launch({
        headless: true, // Set to false for debugging (change to false to see browser)
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
          '--disable-blink-features=AutomationControlled',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-extensions',
          '--disable-backgrounding-occluded-windows'
        ],
        timeout: 30000, // 30 second timeout for browser launch
        protocolTimeout: 30000 // 30 second timeout for browser communication
      });

      const page = await browser.newPage();

      // Add stealth scripts to avoid detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      // Set a reasonable viewport
      await page.setViewport({ width: 1280, height: 800 });

      // Add extra wait time for dynamic content
      await page.setDefaultNavigationTimeout(60000); // 60 seconds

      // Navigate to the URL with shorter timeout
      console.log(`Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 10000 // Reduced to 10 seconds
      });

      console.log('Page loaded, waiting for content...');

      // Wait for content to load - reduced time
      await page.waitForTimeout(1000);

      // Additional wait for JavaScript to execute and content to load
      await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });

      // Trigger potential lazy-loaded images by scrolling - reduced waits
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(500); // Reduced wait time

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(500); // Reduced wait time

      // Wait for images to be loaded with shorter timeout
      await page.evaluate(() => {
        return new Promise((resolve) => {
          // Check if all images are loaded
          const images = Array.from(document.images);
          const unloadedImages = images.filter(img => !img.complete);

          if (unloadedImages.length === 0) {
            resolve();
            return;
          }

          let loadedCount = 0;
          const checkLoaded = () => {
            loadedCount++;
            if (loadedCount === unloadedImages.length) {
              resolve();
            }
          };

          unloadedImages.forEach(img => {
            img.addEventListener('load', checkLoaded);
            img.addEventListener('error', checkLoaded);
          });

          // Resolve anyway after shorter time if some images are slow
          setTimeout(resolve, 1000); // Reduced from 2 seconds to 1 second
        });
      });

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
  const result = await page.evaluate(() => {
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
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        title = element.textContent.trim();
        break;
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
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        price = element.textContent.trim();
        // Clean up the price text to remove extra spaces and newlines
        price = price.replace(/\s+/g, ' ').trim();
        break;
      }
    }

    // If we still don't have a price, try to find it in the entire document
    if (!price) {
      // Look for price patterns in the whole document
      const pricePatterns = [
        /(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)[\s\u00a0]?([\d\s.,]+)/i,
        /([\d\s.,]+)[\s\u00a0]?(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)/i,
        /цена[:\s]+([\d\s.,]+)/i,
        /price[:\s]+([\d\s.,]+)/i
      ];

      for (const pattern of pricePatterns) {
        const match = document.body.innerText.match(pattern);
        if (match) {
          price = match[1].trim();
          break;
        }
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
      const elements = document.querySelectorAll(selector);
      console.log(`Selector "${selector}" found ${elements.length} elements`);

      for (const element of elements) {
        // Try multiple possible image URL sources, including Angular-specific attributes
        let imageUrl = element.src ||
                      element.dataset.src ||
                      element.getAttribute('data-lazy-src') ||
                      element.getAttribute('ng-src') ||
                      element.getAttribute('data-original') ||
                      element.getAttribute('data-ng-src');

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
              const pageUrl = document.baseURI;
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
    }

    return {
      title: title,
      price: price,
      image: image
    };
  });

  return result;
}

// Extract product info from Prom.ua
async function extractPromInfo(page) {
  const result = await page.evaluate(() => {
    // Try to get product title - multiple possible selectors
    let title = null;
    const titleSelectors = [
      'h1[data-product-name]',
      'h1.title',
      'h1.product-title',
      'h1'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        title = element.textContent.trim();
        break;
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
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        price = element.textContent.trim();
        // Clean up the price text to remove extra spaces and newlines
        price = price.replace(/\s+/g, ' ').trim();
        break;
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
      const element = document.querySelector(selector);
      if (element) {
        image = element.src;
        if (image) break;
      }
    }

    return {
      title: title,
      price: price,
      image: image
    };
  });

  return result;
}

// Extract product info from OLX
async function extractOlxInfo(page) {
  const result = await page.evaluate(() => {
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
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        title = element.textContent.trim();
        break;
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
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        price = element.textContent.trim();
        // Clean up the price text to remove extra spaces and newlines
        price = price.replace(/\s+/g, ' ').trim();
        break;
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
      const element = document.querySelector(selector);
      if (element) {
        image = element.src;
        if (image) break;
      }
    }

    return {
      title: title,
      price: price,
      image: image
    };
  });

  return result;
}

// Extract product info from Amazon
async function extractAmazonInfo(page) {
  const result = await page.evaluate(() => {
    // Try to get product title
    const titleElement = document.querySelector('#productTitle') ||
                         document.querySelector('#title') ||
                         document.querySelector('h1[data-a-size="large"]');

    // Try to get price
    const priceElement = document.querySelector('#priceblock_ourprice') ||
                         document.querySelector('#priceblock_dealprice') ||
                         document.querySelector('.a-price .a-offscreen') ||
                         document.querySelector('#tp_price_block_ourprice_sims_feature_div');

    // Try to get image
    const imageElement = document.querySelector('#landingImage') ||
                         document.querySelector('#imgBlkFront') ||
                         document.querySelector('#altImages img') ||
                         document.querySelector('#imageBlock img');

    return {
      title: titleElement ? titleElement.textContent.trim() : null,
      price: priceElement ? priceElement.textContent.trim() : null,
      image: imageElement ? imageElement.src : null
    };
  });

  return result;
}

// Extract product info from eBay
async function extractEbayInfo(page) {
  const result = await page.evaluate(() => {
    // Try to get product title
    const titleElement = document.querySelector('#CenterPanelInternal h1') ||
                         document.querySelector('h1#vi-lkhdr-itmTitl') ||
                         document.querySelector('h1.x-item-title__mainTitle');

    // Try to get price
    const priceElement = document.querySelector('.notranslate.x-price-primary') ||
                         document.querySelector('#prcIsum') ||
                         document.querySelector('.x-price-primary');

    // Try to get image
    const imageElement = document.querySelector('#icImg') ||
                         document.querySelector('#mainImgHldr') ||
                         document.querySelector('.ux-image-carousel-item img') ||
                         document.querySelector('img#icImg');

    return {
      title: titleElement ? titleElement.textContent.trim() : null,
      price: priceElement ? priceElement.textContent.trim() : null,
      image: imageElement ? imageElement.src : null
    };
  });

  return result;
}

// Extract product info from Best Buy
async function extractBestBuyInfo(page) {
  const result = await page.evaluate(() => {
    // Try to get product title
    const titleElement = document.querySelector('h1.heading-5') ||
                         document.querySelector('h1.product-name') ||
                         document.querySelector('h1[data-test="product-title"]');

    // Try to get price
    const priceElement = document.querySelector('.priceView-hero-price .price') ||
                         document.querySelector('[data-test="product-price-current"]') ||
                         document.querySelector('.sr-only');

    // Try to get image
    const imageElement = document.querySelector('img.primary-image') ||
                         document.querySelector('img[data-test="primary-hero-image"]') ||
                         document.querySelector('img.zoom-image');

    return {
      title: titleElement ? titleElement.textContent.trim() : null,
      price: priceElement ? priceElement.textContent.trim() : null,
      image: imageElement ? imageElement.src : null
    };
  });

  return result;
}

// Extract product info from Target
async function extractTargetInfo(page) {
  const result = await page.evaluate(() => {
    // Try to get product title
    const titleElement = document.querySelector('h1[data-test="product-title"]') ||
                         document.querySelector('h1.test@product.title') ||
                         document.querySelector('h1');

    // Try to get price
    const priceElement = document.querySelector('[data-test="product-price"]') ||
                         document.querySelector('.price') ||
                         document.querySelector('[data-test="current-price"]');

    // Try to get image
    const imageElement = document.querySelector('img[data-test="image"]') ||
                         document.querySelector('img.ProductImage-module__image___3oCZv') ||
                         document.querySelector('img');

    return {
      title: titleElement ? titleElement.textContent.trim() : null,
      price: priceElement ? priceElement.textContent.trim() : null,
      image: imageElement ? imageElement.src : null
    };
  });

  return result;
}

// Extract product info from AliExpress
async function extractAliexpressInfo(page) {
  const result = await page.evaluate(() => {
    // Try to get product title
    const titleElement = document.querySelector('h1.product-title') ||
                         document.querySelector('h1[data-spm="productTitle"]') ||
                         document.querySelector('.product-title-text');

    // Try to get price
    const priceElement = document.querySelector('.uniform-banner-box-price') ||
                         document.querySelector('.product-price-value') ||
                         document.querySelector('[data-spm="price"]');

    // Try to get image
    const imageElement = document.querySelector('#imgExchange img') ||
                         document.querySelector('.magnifier-handle') ||
                         document.querySelector('img#characteristic-img-0');

    return {
      title: titleElement ? titleElement.textContent.trim() : null,
      price: priceElement ? priceElement.textContent.trim() : null,
      image: imageElement ? imageElement.src : null
    };
  });

  return result;
}

// Generic extraction using Open Graph tags and other meta information
async function extractGenericInfo(page) {
  const result = await page.evaluate(() => {
    // Try to get Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content ||
                    document.querySelector('meta[name="twitter:title"]')?.content ||
                    document.querySelector('meta[property="og:site_name"]')?.content;

    // Look for price in various formats
    const ogPrice = document.querySelector('meta[property="product:price:amount"]')?.content ||
                    document.querySelector('meta[name="twitter:data1"]')?.content ||
                    document.querySelector('meta[name="twitter:data2"]')?.content ||
                    document.querySelector('meta[itemprop="price"]')?.content;

    let ogImage = document.querySelector('meta[property="og:image"]')?.content ||
                  document.querySelector('meta[name="twitter:image"]')?.content ||
                  document.querySelector('link[rel="image_src"]')?.href;

    // If no og:image found, try to find the largest image on the page
    if (!ogImage) {
      console.log('No og:image found, looking for largest image on page...');
      const images = Array.from(document.querySelectorAll('img'));
      console.log(`Found ${images.length} images on the page`);

      // Filter out tiny images and find the largest one
      const validImages = images.filter(img => {
        // Check if image has a valid src
        const src = img.src || img.dataset.src;
        if (!src || src.startsWith('data:') || src.includes('placeholder') || src.includes('svg')) {
          return false;
        }

        // Check dimensions if possible
        const rect = img.getBoundingClientRect();
        return rect.width > 50 && rect.height > 50; // At least 50x50 pixels
      });

      console.log(`Found ${validImages.length} valid images after filtering`);

      if (validImages.length > 0) {
        const largestImage = validImages.sort((a, b) => {
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          const aSize = aRect.width * aRect.height;
          const bSize = bRect.width * bRect.height;
          return bSize - aSize; // Sort by size descending
        })[0];

        if (largestImage) {
          ogImage = largestImage.src;
          console.log('Selected largest image:', ogImage);
        }
      }
    }

    // Also try to get the document title as fallback
    const docTitle = document.title;

    // Try to find price in the page content (for when sites don't use meta tags properly)
    const priceInText = Array.from(document.querySelectorAll('*'))
      .map(el => el.textContent)
      .join(' ')
      .match(/(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)[\s\u00a0]?([\d\s.,]+)/i)?.[1] ||
      Array.from(document.querySelectorAll('script'))
      .map(script => script.textContent)
      .join(' ')
      .match(/(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)[\s\u00a0]?([\d\s.,]+)/i)?.[1];

    // Make sure the image URL is absolute
    if (ogImage) {
      try {
        new URL(ogImage);
      } catch (e) {
        // If it's a relative URL, convert to absolute
        if (ogImage.startsWith('//')) {
          ogImage = 'https:' + ogImage;
        } else if (ogImage.startsWith('/')) {
          const pageUrl = document.baseURI;
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
  });

  return result;
}

// Content-based extraction for when other methods fail
async function extractContentBasedInfo(page) {
  const result = await page.evaluate(() => {
    // Try to find product title in various common patterns
    let title = null;

    // Look for headings that might contain product names
    const headingElements = document.querySelectorAll('h1, h2, h3, .title, .name, .product-title, .product-name');
    for (const element of headingElements) {
      const text = element.textContent.trim();
      // Skip if text is too short or contains common non-product words
      if (text.length > 5 &&
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

    // If no title found in headings, try to get from document title
    if (!title) {
      title = document.title;
      // Remove common site name patterns
      title = title.replace(/[-_]\s*(.*)$/, '').trim();
    }

    // Try to find price in various formats
    let price = null;
    const pricePatterns = [
      /(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)[\s\u00a0]?([\d\s.,]+)/i,
      /([\d\s.,]+)[\s\u00a0]?(?:\$|€|£|₴|грн|\bUAH\b|\brub\b|\bруб\b)/i,
      /цена[:\s]+([\d\s.,]+)/i,
      /price[:\s]+([\d\s.,]+)/i,
      /від\s+([\d\s.,]+)/i,  // "from" in Ukrainian
      /від\s+.*?([\d\s.,]+)/i
    ];

    // Search in all text content
    const allText = document.body.innerText;
    for (const pattern of pricePatterns) {
      const match = allText.match(pattern);
      if (match) {
        price = match[1].trim();
        break;
      }
    }

    // If no price found in text, try to find in elements with price-related classes
    if (!price) {
      const priceElements = document.querySelectorAll('.price, .cost, .amount, [class*="price"], [class*="cost"]');
      for (const element of priceElements) {
        const text = element.textContent.trim();
        const priceMatch = text.match(/[\d\s.,]+/);
        if (priceMatch) {
          price = priceMatch[0].trim();
          break;
        }
      }
    }

    // Try to find main product image
    let image = null;

    // Look for images near product title or price elements
    const productArea = document.querySelector('h1, .product, .item, .product-card, .product-detail') || document.body;
    if (productArea) {
      const imagesInArea = productArea.querySelectorAll('img');
      // Find the largest image in the product area
      let largestImageSize = 0;
      for (const img of imagesInArea) {
        const rect = img.getBoundingClientRect();
        const size = rect.width * rect.height;
        if (size > largestImageSize && rect.width > 50 && rect.height > 50) {
          // Skip placeholder images
          const src = img.src || img.dataset.src;
          if (src && !src.includes('placeholder') && !src.includes('no-image') && !src.startsWith('data:')) {
            image = src;
            largestImageSize = size;
          }
        }
      }
    }

    // If no image found in product area, find the largest image on the page
    if (!image) {
      const allImages = document.querySelectorAll('img');
      let largestSize = 0;
      for (const img of allImages) {
        const rect = img.getBoundingClientRect();
        const size = rect.width * rect.height;
        if (size > largestSize && rect.width > 100 && rect.height > 100) {
          const src = img.src || img.dataset.src;
          if (src && !src.includes('placeholder') && !src.includes('no-image') && !src.startsWith('data:')) {
            image = src;
            largestSize = size;
          }
        }
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
          const pageUrl = document.baseURI;
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
  });

  return result;
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
      shareableLink: `${req.protocol}://${req.get('host')}/wishlist/${newList.shareToken}`,
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

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Serve wishlist page by share token (numeric)
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
    res.sendFile(path.join(__dirname, '../client/index.html'));
  } catch (error) {
    console.error('Error retrieving wishlist:', error);
    res.status(500).send('Error retrieving wishlist');
  }
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
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Supported domains: ${SUPPORTED_DOMAINS.join(', ')}`);
  });
}).catch(error => {
  console.error('Failed to start server due to database error:', error);
});

module.exports = app;