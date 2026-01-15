const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001; // Changed to port 3001 to avoid conflicts

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../client')); // Serve static files from the client directory

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
      ]
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

    // Navigate to the URL
    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // Changed from networkidle2 to domcontentloaded
      timeout: 30000 // 30 seconds timeout
    });

    console.log('Page loaded, waiting for content...');

    // Wait for content to load - increased slightly to ensure images load
    await page.waitForTimeout(3000);

    // Additional wait for JavaScript to execute and content to load
    await page.waitForFunction(() => document.readyState === 'complete');

    // Trigger potential lazy-loaded images by scrolling
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1000); // Wait for lazy loading

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1000); // Additional wait for all images

    // Wait for images to be loaded
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

        // Resolve anyway after 2 seconds if some images are slow
        setTimeout(resolve, 2000);
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
  } catch (error) {
    console.error('Error extracting product info:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
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
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract product information'
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Supported domains: ${SUPPORTED_DOMAINS.join(', ')}`);
});

module.exports = app;