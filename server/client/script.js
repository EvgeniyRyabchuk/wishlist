// Constants
const WISHLIST_KEY = 'birthdayWishlists';
const USER_NAME_KEY = 'userName';

// DOM Elements
const wishlistForm = document.getElementById('wishlist-form');
const personNameInput = document.getElementById('person-name');
const itemNameInput = document.getElementById('item-name');
const itemLinkInput = document.getElementById('item-link');
const itemPriceInput = document.getElementById('item-price');
const wishlistItemsGrid = document.getElementById('wishlist-items-grid');
const shareLinkContainer = document.getElementById('share-link-container');
const shareLinkInput = document.getElementById('share-link');
const copyLinkBtn = document.getElementById('copy-link-btn');
const resetFormBtn = document.getElementById('reset-form-btn');
const displayWishlistSection = document.getElementById('display-wishlist');
const displayItemsGrid = document.getElementById('display-items-grid');
const ownerNameSpan = document.getElementById('owner-name');
const bookingModal = document.getElementById('booking-modal');
const closeModal = document.getElementById('close-modal');
const bookingItemName = document.getElementById('booking-item-name');
const bookerNameInput = document.getElementById('booker-name');
const confirmBookingBtn = document.getElementById('confirm-booking-btn');
const linkLoadingDiv = document.getElementById('link-loading');
const linkStatusDiv = document.getElementById('link-status');
const pasteLinkBtn = document.getElementById('paste-link-btn');
// Note: product-image-preview element was removed from HTML to prevent showing preview in form area
// const previewImageContainer = document.getElementById('product-image-preview');
// const previewImage = document.getElementById('preview-image');
// Using fallback elements or null checks
const previewImageContainer = document.getElementById('product-image-preview') || null;
const previewImage = document.getElementById('preview-image') || null;

// Statistics elements
const totalBudgetEl = document.getElementById('total-budget');
const totalItemsEl = document.getElementById('total-items');
const bookedItemsEl = document.getElementById('booked-items');
const availableItemsEl = document.getElementById('available-items');

// Global variables
let currentWishlist = [];
let currentWishlistId = null; // Store the current list ID
let currentWishlistShareToken = null; // Store the share token for the current list
let lastRetrievedMessage = null;
let autoAddEnabled = false; // Flag to enable automatic adding of items


// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Load user's name from localStorage if available
    const savedUserName = localStorage.getItem(USER_NAME_KEY);
    if (savedUserName) {
        bookerNameInput.value = savedUserName;
    }

    // Set up event listeners
    setupEventListeners();

    // Add event listener for item link input to fetch product info
    itemLinkInput.addEventListener('blur', function() {
        const url = this.value.trim();
        if (url) {
            fetchProductInfo(url);
        }
    });

    // Add event listener for the paste button
    pasteLinkBtn.addEventListener('click', function() {
        pasteFromClipboard();
    });

    // Add event listener for language selector
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) {
        languageSelector.addEventListener('change', function() {
            const selectedLanguage = this.value;
            translatePage(selectedLanguage);
        });
    }

    // Don't show the statistics section initially on homepage
    // Only show it when viewing a specific wishlist
    document.getElementById('statistics-section').classList.add('hidden');
    updateStatistics(); // Initialize stats

    // Render the current wishlist to show initial state (empty or loaded)
    renderCurrentWishlist();

    // Apply default language (English)
    translatePage('en');

    // Remove loading class after initialization
    document.body.classList.remove('loading');
});

// Function to translate the page
function translatePage(language) {
    if (!translations[language]) return;

    // Translate all elements with data-translate attribute
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[language][key]) {
            element.textContent = translations[language][key];
        }
    });

    // Update placeholders and other dynamic content
    const personNameInput = document.getElementById('person-name');
    if (personNameInput) {
        personNameInput.placeholder = translations[language].yourNamePlaceholder;
    }

    const itemLinkInput = document.getElementById('item-link');
    if (itemLinkInput) {
        itemLinkInput.placeholder = 'https://example.com/item';
    }

    const viewLinkInput = document.getElementById('view-link');
    if (viewLinkInput) {
        viewLinkInput.placeholder = translations[language].enterWishlistLink;
    }

    // Update button texts
    const generateLinkBtn = document.getElementById('generate-link-btn');
    if (generateLinkBtn) {
        generateLinkBtn.textContent = translations[language].generateShareableLink;
    }

    const copyLinkBtn = document.getElementById('copy-link-btn');
    if (copyLinkBtn) {
        copyLinkBtn.textContent = translations[language].copy;
    }

    const loadWishlistBtn = document.getElementById('load-wishlist-btn');
    if (loadWishlistBtn) {
        loadWishlistBtn.textContent = translations[language].loadWishlist;
    }

    const confirmBookingBtn = document.getElementById('confirm-booking-btn');
    if (confirmBookingBtn) {
        confirmBookingBtn.textContent = translations[language].confirmBooking;
    }

    // Update the create button text if it exists
    const createBtn = document.getElementById('create-wishlist-btn');
    if (createBtn) {
        createBtn.textContent = translations[language].createButton;
    }

    // Update the paste button text if it exists
    const pasteLinkBtn = document.getElementById('paste-link-btn');
    if (pasteLinkBtn) {
        pasteLinkBtn.textContent = translations[language].pasteAndAdd;
    }

    // Update the reset form button text if it exists
    const resetFormBtn = document.getElementById('reset-form-btn');
    if (resetFormBtn) {
        resetFormBtn.textContent = translations[language].resetForm;
    }
}

function setupEventListeners() {
    // Wishlist form submission
    wishlistForm.addEventListener('submit', addItemToWishlist);
    
    
    // Copy link button
    copyLinkBtn.addEventListener('click', copyShareableLink);

    // Share link button
    const shareLinkBtn = document.getElementById('share-link-btn');
    const whatsappShareBtn = document.getElementById('whatsapp-share');
    const telegramShareBtn = document.getElementById('telegram-share');
    const facebookShareBtn = document.getElementById('facebook-share');
    const twitterShareBtn = document.getElementById('twitter-share');
    const emailShareBtn = document.getElementById('email-share');

    if (shareLinkBtn) {
        shareLinkBtn.addEventListener('click', toggleShareDropdown);
    }

    if (whatsappShareBtn) {
        whatsappShareBtn.addEventListener('click', shareViaWhatsApp);
    }

    if (telegramShareBtn) {
        telegramShareBtn.addEventListener('click', shareViaTelegram);
    }

    if (facebookShareBtn) {
        facebookShareBtn.addEventListener('click', shareViaFacebook);
    }

    if (twitterShareBtn) {
        twitterShareBtn.addEventListener('click', shareViaTwitter);
    }

    if (emailShareBtn) {
        emailShareBtn.addEventListener('click', shareViaEmail);
    }

    // Reset form button
    resetFormBtn.addEventListener('click', resetForm);
    
    
    // Modal close button
    closeModal.addEventListener('click', closeBookingModal);
    
    // Confirm booking button
    confirmBookingBtn.addEventListener('click', confirmBooking);
    
    // Close modal when clicking outside of it (properly handles drag scenarios)
    let isClickStartedInsideModalContent = false;

    // Track if the click started inside the modal content area (not the overlay)
    bookingModal.addEventListener('mousedown', function(event) {
        // Check if the mousedown happened on the overlay (background) or inside the content
        if (event.target === bookingModal) {
            isClickStartedInsideModalContent = false; // Click started on overlay
        } else {
            // Click started inside the modal content area
            isClickStartedInsideModalContent = true;
        }
    });

    // Only close the modal if the click started and ended on the overlay
    bookingModal.addEventListener('mouseup', function(event) {
        if (event.target === bookingModal && !isClickStartedInsideModalContent) {
            closeBookingModal();
        }
        // Reset the flag
        isClickStartedInsideModalContent = false;
    });

    // Close share dropdown when clicking outside of it
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('share-dropdown');
        const shareButton = document.getElementById('share-link-btn');

        if (dropdown && !dropdown.classList.contains('hidden')) {
            if (!dropdown.contains(event.target) && !shareButton.contains(event.target)) {
                dropdown.classList.add('hidden');
            }
        }
    });
}

// Function to fetch product information from URL
async function fetchProductInfo(url) {
    // Show loading indicator
    linkLoadingDiv.classList.remove('hidden');
    linkStatusDiv.classList.add('hidden');

    try {
        // Validate URL format
        const urlObj = new URL(url);

        // Call the server API to extract product info using Puppeteer
        const response = await fetch('/api/extract-product-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        const result = await response.json();

        if (result.success && result.data) {
            const productInfo = result.data;

            // Only update fields if we got meaningful data (not just the domain name)
            if (!itemNameInput.value.trim() && productInfo.title && !productInfo.title.includes(urlObj.hostname)) {
                itemNameInput.value = productInfo.title;
            }

            if (!itemPriceInput.value && productInfo.price) {
                // Extract numeric value from price string
                const priceValue = extractPriceValue(productInfo.price);
                if (priceValue !== null && !isNaN(priceValue)) {
                    itemPriceInput.value = priceValue;
                    console.log('Setting price to:', priceValue);
                } else {
                    console.log('Could not extract valid price from:', productInfo.price);
                }
            }

            // Store the image URL in the input field's dataset and show preview
            if (productInfo.image) {
                itemLinkInput.dataset.image = productInfo.image;

                if (previewImage) {
                    // Store the image but don't show preview in form area
                    previewImage.src = productInfo.image;
                    console.log('Setting image src to:', productInfo.image);
                }

                if (previewImageContainer) {
                    // Keep the preview container hidden to avoid showing in form area
                    previewImageContainer.classList.add('hidden');
                }

                // Handle image loading success
                if (previewImage) {
                    previewImage.onload = function() {
                        console.log('Image loaded successfully:', productInfo.image);
                    };
                }

                // Handle image loading error
                if (previewImage) {
                    previewImage.onerror = function() {
                        console.log('Failed to load image:', productInfo.image);
                        if (previewImageContainer) {
                            previewImageContainer.classList.add('hidden');
                        }
                    };
                }
            } else {
                console.log('No image found in product info');
                // Hide the preview if no image was found
                if (previewImageContainer) {
                    previewImageContainer.classList.add('hidden');
                }
            }

            // Store the retrieved message for potential restoration after form submission
            if (productInfo.title && !productInfo.title.includes(urlObj.hostname)) {
                lastRetrievedMessage = `<span class="text-green-400">✓ Retrieved: ${productInfo.title}</span>`;
            } else {
                lastRetrievedMessage = `<span class="text-orange-400">ℹ️ Could not extract specific product info from ${urlObj.hostname}. Please enter manually.</span>`;
            }

            linkStatusDiv.innerHTML = lastRetrievedMessage;
            linkStatusDiv.classList.remove('hidden');

            // Automatically submit the form if auto-add is enabled
            if (autoAddEnabled) {
                // Wait a bit for UI to update, then submit
                setTimeout(() => {
                    addItemToWishlist(null); // Call directly instead of dispatching event to avoid recursion
                }, 500);
            }
        } else {
            console.log('Failed to extract product info:', result);
            linkStatusDiv.innerHTML = `<span class="text-orange-400">ℹ️ Could not extract product info from ${urlObj.hostname}. Please enter manually.</span>`;
            linkStatusDiv.classList.remove('hidden');

            // If auto-add is enabled but we couldn't extract info, still add the item with URL
            if (autoAddEnabled) {
                setTimeout(() => {
                    addItemToWishlist(null); // Call directly instead of dispatching event to avoid recursion
                }, 500);
            }
        }
    } catch (error) {
        console.error('Error fetching product info:', error);
        linkStatusDiv.innerHTML = '<span class="text-red-400">⚠️ Error retrieving product info. Please enter manually.</span>';
        linkStatusDiv.classList.remove('hidden');

        // Hide image preview on error
        if (previewImageContainer) {
            previewImageContainer.classList.add('hidden');
        }

        // If auto-add is enabled but we had an error, still try to add the item with URL
        if (autoAddEnabled) {
            setTimeout(() => {
                addItemToWishlist(null); // Call directly instead of dispatching event to avoid recursion
            }, 500);
        }
    } finally {
        // Hide loading indicator
        linkLoadingDiv.classList.add('hidden');
    }
}

// Function to paste URL from clipboard
async function pasteFromClipboard() {
    try {
        // Check if Clipboard API is supported and we're in a secure context
        const isSecureContext = window.isSecureContext;
        const hasClipboardSupport = navigator.clipboard && navigator.clipboard.readText;

        if (hasClipboardSupport && isSecureContext) {
            const clipboardText = await navigator.clipboard.readText();

            // Check if clipboard contains a valid URL
            const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

            if (urlPattern.test(clipboardText)) {
                // If this is the first item and we don't have a list yet, create a new list
                if (currentWishlist.length === 0 && !currentWishlistId) {
                    const personName = personNameInput.value.trim();
                    if (!personName) {
                        alert('Please enter your name first');
                        return;
                    }

                    try {
                        // Create a new list on the server
                        const response = await fetch('/api/lists', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                title: `${personName}'s Wishlist`,
                                description: `Wishlist created by ${personName}`,
                                creatorName: personName
                            })
                        });

                        const result = await response.json();

                        if (result.id) {
                            // Store the list ID and share token for future updates
                            currentWishlistId = result.id;
                            currentWishlistShareToken = result.shareToken;

                            // Update the URL to the owner's view (without /check) for the owner
                            const ownerUrl = `${window.location.origin}/lists/${currentWishlistShareToken}`;
                            window.history.pushState({}, '', ownerUrl);

                            // Show the share link (with /check for guests)
                            const shareableLink = `${window.location.origin}/lists/${currentWishlistShareToken}/check`;
                            shareLinkInput.value = shareableLink;
                            shareLinkContainer.classList.remove('hidden');
                        } else {
                            throw new Error(result.error || 'Failed to create wishlist');
                        }
                    } catch (error) {
                        console.error('Error creating wishlist:', error);
                        linkStatusDiv.innerHTML = '<span class="text-red-400">⚠️ Error creating wishlist. Please try again.</span>';
                        linkStatusDiv.classList.remove('hidden');
                        return;
                    }
                }

                // Paste the URL into the input field
                itemLinkInput.value = clipboardText.trim();

                // Show a message to the user
                linkStatusDiv.innerHTML = `<span class="text-green-400">✓ Link pasted from clipboard</span>`;
                linkStatusDiv.classList.remove('hidden');

                // Enable auto-add and start the product info extraction
                autoAddEnabled = true;
                fetchProductInfo(clipboardText.trim());
            } else {
                // Show message if no valid URL found
                linkStatusDiv.innerHTML = `<span class="text-orange-400">ℹ️ No valid URL found in clipboard</span>`;
                linkStatusDiv.classList.remove('hidden');
            }
        } else {
            // Fallback: Prompt user to manually paste the URL
            const manualPaste = prompt('Clipboard API not supported in your environment.\n\nPlease copy your product URL, then paste it here:');

            if (manualPaste !== null) { // User didn't cancel
                const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

                if (urlPattern.test(manualPaste)) {
                    // If this is the first item and we don't have a list yet, create a new list
                    if (currentWishlist.length === 0 && !currentWishlistId) {
                        const personName = personNameInput.value.trim();
                        if (!personName) {
                            alert('Please enter your name first');
                            return;
                        }

                        try {
                            // Create a new list on the server
                            const response = await fetch('/api/lists', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    title: `${personName}'s Wishlist`,
                                    description: `Wishlist created by ${personName}`,
                                    creatorName: personName
                                })
                            });

                            const result = await response.json();

                            if (result.id) {
                                // Store the list ID and share token for future updates
                                currentWishlistId = result.id;
                                currentWishlistShareToken = result.shareToken;

                                // Update the URL to the owner's view (without /check) for the owner
                                const ownerUrl = `${window.location.origin}/lists/${currentWishlistShareToken}`;
                                window.history.pushState({}, '', ownerUrl);

                                // Show the share link (with /check for guests)
                                const shareableLink = `${window.location.origin}/lists/${currentWishlistShareToken}/check`;
                                shareLinkInput.value = shareableLink;
                                shareLinkContainer.classList.remove('hidden');
                            } else {
                                throw new Error(result.error || 'Failed to create wishlist');
                            }
                        } catch (error) {
                            console.error('Error creating wishlist:', error);
                            linkStatusDiv.innerHTML = '<span class="text-red-400">⚠️ Error creating wishlist. Please try again.</span>';
                            linkStatusDiv.classList.remove('hidden');
                            return;
                        }
                    }

                    // Paste the URL into the input field
                    itemLinkInput.value = manualPaste.trim();

                    // Show a message to the user
                    linkStatusDiv.innerHTML = `<span class="text-green-400">✓ Link pasted manually</span>`;
                    linkStatusDiv.classList.remove('hidden');

                    // Enable auto-add and start the product info extraction
                    autoAddEnabled = true;
                    fetchProductInfo(manualPaste.trim());
                } else {
                    // Show message if no valid URL found
                    linkStatusDiv.innerHTML = `<span class="text-orange-400">ℹ️ Invalid URL format. Please enter a valid URL.</span>`;
                    linkStatusDiv.classList.remove('hidden');
                }
            } else {
                // User cancelled the prompt
                linkStatusDiv.innerHTML = `<span class="text-gray-500">ℹ️ Paste cancelled</span>`;
                linkStatusDiv.classList.remove('hidden');
            }
        }
    } catch (err) {
        // Fallback to manual paste if there's an error with the Clipboard API
        console.log('Clipboard API error:', err);

        const manualPaste = prompt('Error accessing clipboard. Please copy your product URL, then paste it here:');

        if (manualPaste !== null) { // User didn't cancel
            const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

            if (urlPattern.test(manualPaste)) {
                // Process the manually pasted URL similar to above
                if (currentWishlist.length === 0 && !currentWishlistId) {
                    const personName = personNameInput.value.trim();
                    if (!personName) {
                        alert('Please enter your name first');
                        return;
                    }

                    try {
                        // Create a new list on the server
                        const response = await fetch('/api/lists', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                title: `${personName}'s Wishlist`,
                                description: `Wishlist created by ${personName}`,
                                creatorName: personName
                            })
                        });

                        const result = await response.json();

                        if (result.id) {
                            // Store the list ID and share token for future updates
                            currentWishlistId = result.id;
                            currentWishlistShareToken = result.shareToken;

                            // Update the URL to the owner's view (without /check) for the owner
                            const ownerUrl = `${window.location.origin}/lists/${currentWishlistShareToken}`;
                            window.history.pushState({}, '', ownerUrl);

                            // Show the share link (with /check for guests)
                            const shareableLink = `${window.location.origin}/lists/${currentWishlistShareToken}/check`;
                            shareLinkInput.value = shareableLink;
                            shareLinkContainer.classList.remove('hidden');
                        } else {
                            throw new Error(result.error || 'Failed to create wishlist');
                        }
                    } catch (error) {
                        console.error('Error creating wishlist:', error);
                        linkStatusDiv.innerHTML = '<span class="text-red-400">⚠️ Error creating wishlist. Please try again.</span>';
                        linkStatusDiv.classList.remove('hidden');
                        return;
                    }
                }

                // Paste the URL into the input field
                itemLinkInput.value = manualPaste.trim();

                // Show a message to the user
                linkStatusDiv.innerHTML = `<span class="text-green-400">✓ Link pasted manually</span>`;
                linkStatusDiv.classList.remove('hidden');

                // Enable auto-add and start the product info extraction
                autoAddEnabled = true;
                fetchProductInfo(manualPaste.trim());
            } else {
                // Show message if no valid URL found
                linkStatusDiv.innerHTML = `<span class="text-orange-400">ℹ️ Invalid URL format. Please enter a valid URL.</span>`;
                linkStatusDiv.classList.remove('hidden');
            }
        } else {
            // User cancelled the prompt
            linkStatusDiv.innerHTML = `<span class="text-gray-500">ℹ️ Paste cancelled</span>`;
            linkStatusDiv.classList.remove('hidden');
        }
    }
}

// Helper function to extract numeric price value from price string
function extractPriceValue(priceString) {
    if (!priceString) return null;

    console.log('Processing price string:', priceString);

    // Handle various international price formats
    // Remove currency symbols and non-numeric characters, keeping decimal points, commas and spaces
    let cleanedPrice = priceString
        .replace(/[^\d\s,.]/g, '')  // Keep only digits, spaces, dots, commas
        .trim();

    console.log('Cleaned price string:', cleanedPrice);

    // Handle different decimal/thousands separators based on common patterns
    // If there are multiple commas and only one dot, commas are likely thousands separators
    const commaCount = (cleanedPrice.match(/,/g) || []).length;
    const dotCount = (cleanedPrice.match(/\./g) || []).length;

    if (commaCount > 1 && dotCount <= 1) {
        // Commas are thousands separators, remove them
        cleanedPrice = cleanedPrice.replace(/,/g, '');
    } else if (commaCount === 1 && dotCount === 0) {
        // Comma is decimal separator, replace with dot
        cleanedPrice = cleanedPrice.replace(/,/g, '.');
    } else if (commaCount > 1 && dotCount === 1) {
        // If dot comes after commas, it's decimal separator, remove commas
        // If dot comes before commas, comma might be decimal separator
        const dotIndex = cleanedPrice.lastIndexOf('.');
        const commaIndex = cleanedPrice.lastIndexOf(',');
        if (commaIndex > dotIndex) {
            // Last comma comes after last dot, treat comma as decimal separator
            cleanedPrice = cleanedPrice.replace(/\./g, ''); // Remove dots (thousands)
            cleanedPrice = cleanedPrice.replace(/,/g, '.'); // Replace last comma with dot
        } else {
            // Dot is decimal separator, remove commas
            cleanedPrice = cleanedPrice.replace(/,/g, '');
        }
    }

    // Remove spaces (common in European formats)
    cleanedPrice = cleanedPrice.replace(/\s/g, '');

    console.log('After processing:', cleanedPrice);

    // Extract the numeric value
    const priceMatch = cleanedPrice.match(/[\d.]+/);
    if (priceMatch) {
        const parsedValue = parseFloat(priceMatch[0]);
        if (!isNaN(parsedValue)) {
            console.log('Parsed price value:', parsedValue);
            return parsedValue;
        }
    }

    console.log('Could not parse price');
    return null;
}

// Add item to the current wishlist
async function addItemToWishlist(e) {
    if (e) e.preventDefault();

    const personName = personNameInput.value.trim();
    const itemName = itemNameInput.value.trim();
    const itemLink = itemLinkInput.value.trim();
    const itemPrice = itemPriceInput.value.trim();

    if (!personName || !itemName) {
        alert('Please fill in the required fields');
        return;
    }

    // Check for duplicate URLs to avoid adding the same item twice
    const currentLang = document.getElementById('language-selector').value || 'en';
    if (itemLink && currentWishlist.some(item => item.link && item.link === itemLink)) {
        linkStatusDiv.innerHTML = `<span class="text-orange-400">⚠️ ${translations[currentLang].duplicateUrl}</span>`;
        linkStatusDiv.classList.remove('hidden');
        return;
    }

    // If this is the first item and we don't have a list yet, create a new list
    if (currentWishlist.length === 0 && !currentWishlistId) {
        try {
            // Create a new list on the server
            const response = await fetch('/api/lists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: `${personName}'s Wishlist`,
                    description: `Wishlist created by ${personName}`,
                    creatorName: personName
                })
            });

            const result = await response.json();

            if (result.id) {
                // Store the list ID and share token for future updates
                currentWishlistId = result.id;
                currentWishlistShareToken = result.shareToken;

                // Update the URL to include the list ID without page reload
                const newUrl = `${window.location.origin}/lists/${currentWishlistShareToken}`;
                window.history.pushState({}, '', newUrl);

                // Show the share link
                shareLinkInput.value = newUrl;
                shareLinkContainer.classList.remove('hidden');
            } else {
                throw new Error(result.error || 'Failed to create wishlist');
            }
        } catch (error) {
            console.error('Error creating wishlist:', error);
            linkStatusDiv.innerHTML = '<span class="text-red-400">⚠️ Error creating wishlist. Please try again.</span>';
            linkStatusDiv.classList.remove('hidden');
            return;
        }
    }

    const newItem = {
        // Use a temporary ID that won't conflict with DB IDs
        id: `temp_${Date.now()}`,
        name: itemName,
        link: itemLink,
        price: itemPrice ? parseFloat(itemPrice) : null,
        image: itemLinkInput.dataset.image || null, // Store image from extraction
        bookedBy: null
    };

    currentWishlist.push(newItem);
    renderCurrentWishlist();

    // If we have a current list ID, add the item directly to the server list
    if (currentWishlistId) {
        try {
            let response;
            if (itemLink) {
                // Add item to the server list from URL
                response = await fetch('/api/goods', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        listId: currentWishlistId,
                        url: itemLink
                    })
                });
            } else {
                // Add item to the server list with manual data
                response = await fetch('/api/goods', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        listId: currentWishlistId,
                        url: '', // No URL for manually entered items
                        name: itemName,
                        price: itemPrice ? parseFloat(itemPrice) : null,
                        imageUrl: itemLinkInput.dataset.image || null
                    })
                });
            }

            // Get the server response to update the item ID
            if (response.ok) {
                const result = await response.json();
                // Update the item's ID with the server-assigned ID
                const itemIndex = currentWishlist.findIndex(item => item.id.startsWith('temp_'));
                if (itemIndex !== -1) {
                    currentWishlist[itemIndex].id = result.id.toString();
                }
            }

            // Update the share link to reflect the new item
            if (currentWishlistShareToken) {
                const shareableLink = `${window.location.origin}/lists/${currentWishlistShareToken}/check`;

                // Update the URL to the owner's view (without /check) for the owner
                const ownerUrl = `${window.location.origin}/lists/${currentWishlistShareToken}`;
                if (!window.location.pathname.includes(currentWishlistShareToken) || window.location.pathname.endsWith('/check')) {
                    window.history.replaceState({}, '', ownerUrl);
                }

                shareLinkInput.value = shareableLink;
                shareLinkContainer.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error adding item to existing list:', error);
            linkStatusDiv.innerHTML = '<span class="text-red-400">⚠️ Error adding item to existing list. Item saved locally.</span>';
            linkStatusDiv.classList.remove('hidden');
        }
    }

    // Clear form inputs except person's name
    itemNameInput.value = '';
    itemLinkInput.value = '';
    itemPriceInput.value = '';
    // Clear the image data attribute
    delete itemLinkInput.dataset.image;
    // Hide the image preview
    if (previewImageContainer) {
        previewImageContainer.classList.add('hidden');
    }
    // Show a confirmation message or restore the retrieved message
    if (lastRetrievedMessage) {
        // Keep the retrieved message and append the addition confirmation
        linkStatusDiv.innerHTML = lastRetrievedMessage + ` <span class="text-green-400">✓ ${translations[currentLang].addToWishlist}</span>`;
    } else {
        linkStatusDiv.innerHTML = `<span class="text-green-400">✓ ${translations[currentLang].addToWishlist}</span>`;
    }
    linkStatusDiv.classList.remove('hidden');

    // Reset auto-add flag after item is added
    autoAddEnabled = false;
}

// Render the current wishlist
function renderCurrentWishlist() {
    wishlistItemsGrid.innerHTML = '';

    if (currentWishlist.length === 0) {
        wishlistItemsGrid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-12"><span class="text-lg font-medium text-gray-500">No Goods</span></div>';
        updateStatistics(); // Update stats when list is empty

        // Hide the generate link button when there are no items
        const genLinkBtn = document.getElementById('generate-link-btn');
        if (genLinkBtn) {
            genLinkBtn.classList.add('hidden');
        }

        // Hide the reset form button when there are no items
        const resetFormBtn = document.getElementById('reset-form-btn');
        if (resetFormBtn) {
            resetFormBtn.classList.add('hidden');
        }
        return;
    }

    currentWishlist.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'wishlist-item glass-card p-4 rounded-xl bg-white/10 border border-white/20 flex flex-col';
        card.dataset.itemId = item.id;

        let priceDisplay = '';
        if (item.price) {
            priceDisplay = `<div class="text-green-800 font-medium">Price: $${item.price.toFixed(2)}</div>`;
        }

        let linkDisplay = '';
        if (item.link) {
            linkDisplay = `<a href="${item.link}" target="_blank" class="glass-button px-4 py-2 rounded-lg text-white font-medium hover:bg-indigo-600 transition-all primary-action text-sm block text-center">Открыть</a>`;
        }

        let imageDisplay = '';
        if (item.image) {
            if (item.link) {
                imageDisplay = `<a href="${item.link}" target="_blank"><img src="${item.image}" alt="${item.name}" class="w-full h-32 object-contain rounded-lg mb-2" onerror="this.style.display='none';"></a>`;
            } else {
                imageDisplay = `<img src="${item.image}" alt="${item.name}" class="w-full h-32 object-contain rounded-lg mb-2" onerror="this.style.display='none';">`;
            }
        }

        card.innerHTML = `
            <div class="flex flex-col h-full">
                ${imageDisplay}
                <div class="flex-1 flex flex-col justify-between">
                    <div>
                        <div class="font-medium text-white text-sm mb-1 line-clamp-2 label-contrast">${item.name}</div>
                        ${priceDisplay}
                    </div>
                    <div class="mt-2">
                        ${linkDisplay}
                        <div class="mt-2">
                            <button class="remove-btn w-full bg-rose-300 hover:bg-rose-400 py-2 rounded-lg text-white font-medium transition-all primary-action text-sm" data-index="${index}">
                                <span class="mobile-icon">✕ </span><span class="mobile-text">Remove</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event listener to remove button
        const removeBtn = card.querySelector('.remove-btn');
        removeBtn.addEventListener('click', async function() {
            const item = currentWishlist[index];

            // Remove from server database if the item has an ID (was saved to server)
            if (item.id) {
                try {
                    // Assuming the item.id corresponds to the goods ID in the database
                    await fetch(`/api/goods/${item.id}`, {
                        method: 'DELETE'
                    });
                } catch (error) {
                    console.error('Error removing item from server:', error);
                    // Still remove from local array even if server removal fails
                }
            }

            // Remove from local array
            currentWishlist.splice(index, 1);
            renderCurrentWishlist();
        });

        wishlistItemsGrid.appendChild(card);
    });

    // Show the generate link button when there are items
    const genLinkBtn = document.getElementById('generate-link-btn');
    if (genLinkBtn) {
        genLinkBtn.classList.remove('hidden');
    }

    // Show the reset form button when there are items
    const resetFormBtn = document.getElementById('reset-form-btn');
    if (resetFormBtn) {
        resetFormBtn.classList.remove('hidden');
    }

    updateStatistics(); // Update stats after rendering
}

// Update statistics table
function updateStatistics() {
    // Calculate statistics for current wishlist (creation view)
    let totalBudget = 0;
    let totalItems = currentWishlist.length;
    let bookedItems = 0;
    let availableItems = 0;
    
    currentWishlist.forEach(item => {
        if (item.price) {
            totalBudget += item.price;
        }
        // For the creator's view, items are not yet booked by others
        // So all items are considered available from the creator's perspective
        availableItems++;
    });
    
    // Update the statistics table
    totalBudgetEl.textContent = `$${totalBudget.toFixed(2)}`;
    totalItemsEl.textContent = totalItems;
    bookedItemsEl.textContent = bookedItems;
    availableItemsEl.textContent = availableItems;
}

// Update statistics for display view (when others view the wishlist)
function updateDisplayStatistics(items) {
    let totalBudget = 0;
    let totalItems = items.length;
    let bookedItems = 0;
    let availableItems = 0;
    
    items.forEach(item => {
        if (item.price) {
            totalBudget += item.price;
        }
        if (item.bookedBy) {
            bookedItems++;
        } else {
            availableItems++;
        }
    });
    
    // Update the statistics table
    totalBudgetEl.textContent = `$${totalBudget.toFixed(2)}`;
    totalItemsEl.textContent = totalItems;
    bookedItemsEl.textContent = bookedItems;
    availableItemsEl.textContent = availableItems;
}

// Generate a shareable link for the wishlist using server API
async function generateShareableLink() {
    if (currentWishlist.length === 0) {
        console.log('No items to generate link for');
        return;
    }

    const personName = personNameInput.value.trim();
    if (!personName) {
        console.log('No person name provided');
        return;
    }

    try {
        // If we already have a list, just update the share link
        if (currentWishlistId && currentWishlistShareToken) {
            // Just update the share link since the list already exists (with /check for guests)
            const shareableLink = `${window.location.origin}/lists/${currentWishlistShareToken}/check`;
            shareLinkInput.value = shareableLink;
            shareLinkContainer.classList.remove('hidden');

            // Show success message
            const currentLang = document.getElementById('language-selector').value || 'en';
            linkStatusDiv.innerHTML = `<span class="text-green-400">✓ ${translations[currentLang].shareableLinkGenerated}</span>`;
            linkStatusDiv.classList.remove('hidden');
        } else {
            // Create a list on the server
            const response = await fetch('/api/lists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: `${personName}'s Wishlist`,
                    description: `Wishlist created by ${personName}`,
                    creatorName: personName
                })
            });

            const result = await response.json();

            if (result.id) {
                // Store the list ID and share token for future updates
                currentWishlistId = result.id;
                currentWishlistShareToken = result.shareToken;

                // Update the URL to the owner's view (without /check) for the owner
                const ownerUrl = `${window.location.origin}/lists/${currentWishlistShareToken}`;
                window.history.pushState({}, '', ownerUrl);

                // Add all items to the list in parallel for better performance
                const addItemsPromises = currentWishlist.map(item => {
                    if (item.link) {
                        // Add item to the server list from URL
                        return fetch('/api/goods', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                listId: result.id,
                                url: item.link
                            })
                        });
                    } else {
                        // Add item to the server list with manual data
                        return fetch('/api/goods', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                listId: result.id,
                                url: '', // No URL for manually entered items
                                name: item.name,
                                price: item.price,
                                imageUrl: item.image
                            })
                        });
                    }
                });

                // Wait for all items to be added
                await Promise.all(addItemsPromises);

                // Use the new shareable link format (with /check for guests)
                const shareableLink = `${window.location.origin}/lists/${currentWishlistShareToken}/check`;

                shareLinkInput.value = shareableLink;
                shareLinkContainer.classList.remove('hidden');

                // Show success message
                const currentLang = document.getElementById('language-selector').value || 'en';
                linkStatusDiv.innerHTML = `<span class="text-green-400">✓ ${translations[currentLang].shareableLinkGenerated}</span>`;
                linkStatusDiv.classList.remove('hidden');
            } else {
                throw new Error(result.error || 'Failed to create wishlist');
            }
        }
    } catch (error) {
        console.error('Error generating shareable link:', error);
        linkStatusDiv.innerHTML = `<span class="text-red-400">⚠️ Error generating link: ${error.message}</span>`;
        linkStatusDiv.classList.remove('hidden');
    }
}

// Copy the shareable link to clipboard
function copyShareableLink() {
    shareLinkInput.select();
    document.execCommand('copy');

    // Show feedback
    const currentLang = document.getElementById('language-selector').value || 'en';
    const originalText = copyLinkBtn.textContent;
    copyLinkBtn.textContent = translations[currentLang].copied;
    setTimeout(() => {
        copyLinkBtn.textContent = originalText;
    }, 2000);
}

// Toggle the share dropdown menu
function toggleShareDropdown() {
    const dropdown = document.getElementById('share-dropdown');
    dropdown.classList.toggle('hidden');
}

// Share link via WhatsApp
function shareViaWhatsApp() {
    const shareLink = shareLinkInput.value;
    const encodedLink = encodeURIComponent(shareLink);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent('Check out my wishlist: ' + shareLink)}`;
    window.open(whatsappUrl, '_blank');
}

// Share link via Telegram
function shareViaTelegram() {
    const shareLink = shareLinkInput.value;
    const encodedLink = encodeURIComponent(shareLink);
    const telegramUrl = `https://t.me/share/url?url=${encodedLink}&text=${encodeURIComponent('Check out my wishlist: ')}`;
    window.open(telegramUrl, '_blank');
}

// Share link via Facebook
function shareViaFacebook() {
    const shareLink = shareLinkInput.value;
    const encodedLink = encodeURIComponent(shareLink);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`;
    window.open(facebookUrl, '_blank');
}

// Share link via Twitter
function shareViaTwitter() {
    const shareLink = shareLinkInput.value;
    const encodedLink = encodeURIComponent(shareLink);
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodedLink}&text=${encodeURIComponent('Check out my wishlist: ')}`;
    window.open(twitterUrl, '_blank');
}

// Share link via Email
function shareViaEmail() {
    const shareLink = shareLinkInput.value;
    const subject = encodeURIComponent('Check out my wishlist');
    const body = encodeURIComponent(`Check out my wishlist: ${shareLink}`);
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
}


// Display the loaded wishlist from server data
function displayWishlistFromServer(wishlistData, wishlistId) {
    ownerNameSpan.textContent = wishlistData.creator.name;
    displayItemsGrid.innerHTML = '';

    // Map server goods to the format expected by the UI
    const items = wishlistData.goods.map(good => ({
        id: good.id,
        name: good.name,
        link: good.url,
        price: good.price ? parseFloat(good.price) : null,
        image: good.imageUrl,
        bookedBy: good.reservedByGuest ? good.reservedByGuest.name : null
    }));

    if (items.length === 0) {
        displayItemsGrid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-12"><span class="text-lg font-medium text-gray-500">No Goods</span></div>';
    } else {
        items.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = `wishlist-item glass-card p-4 rounded-xl ${item.bookedBy ? 'booked-item' : ''}`;
            card.dataset.itemId = item.id;

            let priceDisplay = '';
            if (item.price) {
                priceDisplay = `<div class="text-green-800 font-medium label-contrast">Price: $${item.price.toFixed(2)}</div>`;
            }

            let linkDisplay = '';
            if (item.link) {
                linkDisplay = `<a href="${item.link}" target="_blank" class="glass-button px-4 py-2 rounded-lg text-white font-medium hover:bg-indigo-600 transition-all primary-action text-sm block text-center">Открыть</a>`;
            }

            let imageDisplay = '';
            if (item.image) {
                if (item.link) {
                    imageDisplay = `<a href="${item.link}" target="_blank"><img src="${item.image}" alt="${item.name}" class="w-16 h-16 object-cover rounded-lg" onerror="this.style.display='none';"></a>`;
                } else {
                    imageDisplay = `<img src="${item.image}" alt="${item.name}" class="w-16 h-16 object-cover rounded-lg" onerror="this.style.display='none';">`;
                }
            }

            let bookerDisplay = '';
            let bookedItemClass = '';
            let buttonClass = 'glass-button hover:bg-white/25';

            if (item.bookedBy) {
                // Generate a color based on the booker's name
                const colorClass = getColorForName(item.bookedBy);
                bookedItemClass = `booked-item ${colorClass}`;
                bookerDisplay = `<div class="text-sm mb-2 label-contrast">Booked by: ${item.bookedBy}</div>`;
                buttonClass = 'bg-gray-500 cursor-not-allowed';
            } else {
                bookedItemClass = '';
            }

            card.className = `wishlist-item glass-card p-4 rounded-xl ${bookedItemClass}`;

            card.innerHTML = `
                <div class="flex items-center gap-4 h-full">
                    ${imageDisplay}
                    <div class="flex-1 flex flex-col justify-between min-w-0">
                        <div class="mb-2">
                            <div class="font-medium text-white text-sm mb-1 line-clamp-2 label-contrast">${item.name}</div>
                            ${priceDisplay}
                            ${bookerDisplay}
                        </div>
                        <div class="space-y-2">
                            ${linkDisplay}
                            <button class="book-btn w-full bg-orange-500 hover:bg-orange-600 py-2.5 rounded-lg text-white font-medium transition-all primary-action text-base"
                                    data-item-id="${item.id}"
                                    data-wishlist-id="${wishlistId}"
                                    ${item.bookedBy ? 'disabled' : ''}>
                                <span class="mobile-icon">${item.bookedBy ? '✓' : '✓ '} </span><span class="mobile-text">${item.bookedBy ? 'Booked' : 'Book Item'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Add event listener to book button
            const bookBtn = card.querySelector('.book-btn');
            if (!item.bookedBy) {
                bookBtn.addEventListener('click', function() {
                    openBookingModal(item, wishlistId);
                });
            }

            displayItemsGrid.appendChild(card);
        });
    }

    // Check if we're on the creator's page or guest's page
    const currentPath = window.location.pathname;
    const pathParts = currentPath.split('/');
    let isCreatorView = false;

    if (pathParts.includes('lists')) {
        const listsIndex = pathParts.indexOf('lists');
        if (pathParts[listsIndex + 1] && pathParts[listsIndex + 1] !== 'check') {
            if (pathParts[listsIndex + 2] !== 'check') {
                isCreatorView = true;
            }
        }
    }

    // Only show the display wishlist section if it's guest view
    if (!isCreatorView) {
        displayWishlistSection.classList.remove('hidden');
    } else {
        // For creator view, hide the display section
        displayWishlistSection.classList.add('hidden');
    }

    // Update statistics for the displayed wishlist
    updateDisplayStatistics(items);

    // Show the statistics section
    document.getElementById('statistics-section').classList.remove('hidden');

    // Scroll to the wishlist section if it's visible
    if (!isCreatorView) {
        displayWishlistSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Function to generate a color class based on the name
function getColorForName(name) {
    // Simple hash function to generate consistent color based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate hue based on the hash (0-360)
    const hue = hash % 360;

    // Return a class that will be styled with the specific color
    // We'll add the style dynamically
    const colorClass = `booked-${name.replace(/\s+/g, '-').toLowerCase()}`;

    // Create a style element for this specific color if it doesn't exist
    const styleId = `color-${colorClass}`;
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        // Generate a vibrant color with good contrast
        style.textContent = `
            .${colorClass} {
                background-color: hsl(${hue}, 70%, 85%) !important;
                border-color: hsl(${hue}, 70%, 65%) !important;
                color: hsl(${hue}, 50%, 20%) !important;
                opacity: 0.75 !important;
            }
            .${colorClass} .book-btn {
                background-color: hsl(${hue}, 70%, 65%) !important;
            }
        `;
        document.head.appendChild(style);
    }

    return colorClass;
}

// Display the loaded wishlist (from localStorage - kept for backward compatibility)
function displayWishlist(wishlistData, wishlistId) {
    ownerNameSpan.textContent = wishlistData.owner;
    displayItemsGrid.innerHTML = '';

    if (wishlistData.items.length === 0) {
        displayItemsGrid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-12"><span class="text-lg font-medium text-gray-500">No Goods</span></div>';
    } else {
        wishlistData.items.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = `wishlist-item glass-card p-4 rounded-xl ${item.bookedBy ? 'booked-item' : ''}`;
            card.dataset.itemId = item.id;

            let priceDisplay = '';
            if (item.price) {
                priceDisplay = `<div class="text-green-800 font-medium label-contrast">Price: $${item.price.toFixed(2)}</div>`;
            }

            let linkDisplay = '';
            if (item.link) {
                linkDisplay = `<a href="${item.link}" target="_blank" class="glass-button px-4 py-2 rounded-lg text-white font-medium hover:bg-indigo-600 transition-all primary-action text-sm block text-center">Открыть</a>`;
            }

            let imageDisplay = '';
            if (item.image) {
                if (item.link) {
                    imageDisplay = `<a href="${item.link}" target="_blank"><img src="${item.image}" alt="${item.name}" class="w-16 h-16 object-cover rounded-lg" onerror="this.style.display='none';"></a>`;
                } else {
                    imageDisplay = `<img src="${item.image}" alt="${item.name}" class="w-16 h-16 object-cover rounded-lg" onerror="this.style.display='none';">`;
                }
            }

            let bookerDisplay = '';
            let bookedItemClass = '';
            let buttonClass = 'glass-button hover:bg-white/25';

            if (item.bookedBy) {
                // Generate a color based on the booker's name
                const colorClass = getColorForName(item.bookedBy);
                bookedItemClass = `booked-item ${colorClass}`;
                bookerDisplay = `<div class="text-sm mb-2 label-contrast">Booked by: ${item.bookedBy}</div>`;
                buttonClass = 'bg-gray-500 cursor-not-allowed';
            } else {
                bookedItemClass = '';
            }

            card.className = `wishlist-item glass-card p-4 rounded-xl ${bookedItemClass}`;

            card.innerHTML = `
                <div class="flex items-center gap-4 h-full">
                    ${imageDisplay}
                    <div class="flex-1 flex flex-col justify-between min-w-0">
                        <div class="mb-2">
                            <div class="font-medium text-white text-sm mb-1 line-clamp-2 label-contrast">${item.name}</div>
                            ${priceDisplay}
                            ${bookerDisplay}
                        </div>
                        <div class="space-y-2">
                            ${linkDisplay}
                            <button class="book-btn w-full bg-orange-500 hover:bg-orange-600 py-2.5 rounded-lg text-white font-medium transition-all primary-action text-base"
                                    data-item-id="${item.id}"
                                    data-wishlist-id="${wishlistId}"
                                    ${item.bookedBy ? 'disabled' : ''}>
                                <span class="mobile-icon">${item.bookedBy ? '✓' : '✓ '} </span><span class="mobile-text">${item.bookedBy ? 'Booked' : 'Book Item'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Add event listener to book button
            const bookBtn = card.querySelector('.book-btn');
            if (!item.bookedBy) {
                bookBtn.addEventListener('click', function() {
                    openBookingModal(item, wishlistId);
                });
            }

            displayItemsGrid.appendChild(card);
        });
    }

    displayWishlistSection.classList.remove('hidden');

    // Update statistics for the displayed wishlist
    updateDisplayStatistics(wishlistData.items);

    // Show the statistics section
    document.getElementById('statistics-section').classList.remove('hidden');

    // Scroll to the wishlist section
    displayWishlistSection.scrollIntoView({ behavior: 'smooth' });
}

// Open booking modal
function openBookingModal(item, wishlistId) {
    bookingItemName.textContent = item.name;
    bookingModal.dataset.itemId = item.id;
    bookingModal.dataset.wishlistId = wishlistId;

    // Pre-fill the booker's name from localStorage if available
    const savedBookerName = localStorage.getItem(USER_NAME_KEY);
    if (savedBookerName) {
        bookerNameInput.value = savedBookerName;
    } else {
        bookerNameInput.value = ''; // Clear the field if no saved name
    }

    // Update the modal title based on whether the item is already booked by the user
    const confirmBookingBtn = document.getElementById('confirm-booking-btn');
    if (item.bookedBy && item.bookedBy === savedBookerName) {
        confirmBookingBtn.textContent = 'Unbook Item';
    } else {
        confirmBookingBtn.textContent = 'Book Item';
    }

    bookingModal.classList.remove('hidden');
}

// Close booking modal
function closeBookingModal() {
    bookingModal.classList.add('hidden');
}

// Reset form function - clears form fields, removes list from server, and navigates to /lists
async function resetForm() {
    if (!confirm('Are you sure you want to reset the form? This will clear all items and remove the list from the server.')) {
        return;
    }

    try {
        // If there's an existing list, delete it from the server
        if (currentWishlistId) {
            await fetch(`/api/lists/${currentWishlistId}`, {
                method: 'DELETE'
            });
        }

        // Clear all form fields
        personNameInput.value = 'Имениник...';
        itemNameInput.value = '';
        itemLinkInput.value = '';
        itemPriceInput.value = '';

        // Clear any stored image data
        delete itemLinkInput.dataset.image;

        // Clear the wishlist items
        currentWishlist = [];
        renderCurrentWishlist();

        // Hide share link container
        shareLinkContainer.classList.add('hidden');

        // Reset global variables
        currentWishlistId = null;
        currentWishlistShareToken = null;

        // Update URL to /lists without page reload
        window.history.pushState({}, '', '/lists');

        // Show appropriate UI sections
        document.getElementById('create-wishlist').classList.remove('hidden');
        document.getElementById('display-wishlist').classList.add('hidden');

        // Update the URL to /lists without page reload
        window.history.pushState({}, '', '/lists');

        // Clear any status messages
        linkStatusDiv.classList.add('hidden');

        // The button visibility will be handled by renderCurrentWishlist()

    } catch (error) {
        console.error('Error resetting form:', error);
        alert('Error resetting form: ' + error.message);
    }
}

// Confirm booking
async function confirmBooking() {
    const itemId = bookingModal.dataset.itemId;
    const wishlistId = bookingModal.dataset.wishlistId;
    const bookerName = bookerNameInput.value.trim();

    if (!bookerName) {
        alert('Please enter your name');
        return;
    }

    try {
        // Save user's name to localStorage
        localStorage.setItem(USER_NAME_KEY, bookerName);

        // Check if this is an unbooking (if the item is already booked by the same user)
        const wishlistResponse = await fetch(`/api/lists/${wishlistId}`);
        const wishlistData = await wishlistResponse.json();

        if (!wishlistResponse.ok) {
            throw new Error('Failed to load wishlist data');
        }

        // Find the item to check if it's already booked by the same user
        const item = wishlistData.goods.find(good => good.id == itemId);

        if (item && item.reservedByGuest && item.reservedByGuest.name === bookerName) {
            // This is an unbooking request - the same user wants to unbook
            const unbookResponse = await fetch(`/api/goods/${itemId}/unreserve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    guestName: bookerName
                })
            });

            if (unbookResponse.ok) {
                // Reload the wishlist from the server
                const updatedWishlistResponse = await fetch(`/api/lists/${wishlistId}`);
                const updatedWishlistData = await updatedWishlistResponse.json();

                if (updatedWishlistResponse.ok) {
                    // Update the displayed wishlist
                    displayWishlistFromServer(updatedWishlistData, wishlistId);
                } else {
                    alert('Failed to reload wishlist after unbooking');
                }

                // Close the modal
                closeBookingModal();
            } else {
                const errorData = await unbookResponse.json();
                alert('Error unbooking item: ' + (errorData.error || 'Unknown error'));
            }
        } else {
            // This is a booking request
            const response = await fetch(`/api/goods/${itemId}/reserve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    guestName: bookerName
                })
            });

            if (response.ok) {
                // Reload the wishlist from the server
                const wishlistResponse = await fetch(`/api/lists/${wishlistId}`);
                const wishlistData = await wishlistResponse.json();

                if (wishlistResponse.ok) {
                    // Update the displayed wishlist
                    displayWishlistFromServer(wishlistData, wishlistId);
                } else {
                    alert('Failed to reload wishlist after booking');
                }

                // Close the modal
                closeBookingModal();
            } else {
                const errorData = await response.json();
                alert('Error booking item: ' + (errorData.error || 'Unknown error'));
            }
        }
    } catch (error) {
        console.error('Error processing booking/unbooking:', error);
        alert('Error processing request: ' + error.message);
    }
}

// Check if there's a wishlist ID in the URL on page load
window.addEventListener('load', function() {
    // Check for the new URL formats: /lists/ID or /lists/ID/check
    const pathParts = window.location.pathname.split('/');
    let wishlistId = null;
    let isCreatorView = false; // To distinguish between creator view and guest view

    if (pathParts.includes('lists')) {
        const listsIndex = pathParts.indexOf('lists');
        if (pathParts[listsIndex + 1] && pathParts[listsIndex + 1] !== 'check') {
            wishlistId = pathParts[listsIndex + 1];
            // Check if it's followed by 'check' for guest view
            if (pathParts[listsIndex + 2] === 'check') {
                isCreatorView = false; // Guest view mode
            } else {
                isCreatorView = true; // Creator view mode
            }
        }
    }

    // If not found in the new format, check for the legacy format: /wishlist/ID
    if (!wishlistId) {
        if (pathParts.includes('wishlist')) {
            const wishlistIndex = pathParts.indexOf('wishlist');
            if (pathParts[wishlistIndex + 1]) {
                wishlistId = pathParts[wishlistIndex + 1];
                isCreatorView = false; // Legacy format is for guest view
            }
        }
    }

    // If not found in path, check for the old format: ?wishlist=ID
    if (!wishlistId) {
        const urlParams = new URLSearchParams(window.location.search);
        wishlistId = urlParams.get('wishlist');
        isCreatorView = false; // Query param format is for guest view
    }

    // Determine which view to show based on current path
    const currentPath = window.location.pathname;

    // Handle home page vs lists page
    if (currentPath === '/') {
        // Home page - show welcome screen with create button, hide other sections
        document.getElementById('home-page').classList.remove('hidden');
        document.getElementById('create-section').classList.add('hidden');
        document.getElementById('create-wishlist').classList.add('hidden');
        document.getElementById('display-wishlist').classList.add('hidden');
        document.getElementById('statistics-section').classList.add('hidden');

        // Set up the create button to navigate to /lists
        const createBtn = document.getElementById('create-wishlist-btn');
        if (createBtn) {
            createBtn.onclick = function() {
                window.location.href = '/lists';
            };
        }
    } else if (currentPath === '/lists') {
        // Lists creation page - show the creation interface, hide homepage
        document.getElementById('home-page').classList.add('hidden');
        document.getElementById('create-section').classList.remove('hidden');
        document.getElementById('create-wishlist').classList.remove('hidden');
        document.getElementById('display-wishlist').classList.add('hidden');
        document.getElementById('statistics-section').classList.add('hidden');

        // Ensure generate link button is enabled in create mode
        const generateLinkBtn = document.getElementById('generate-link-btn');
        if (generateLinkBtn) {
            generateLinkBtn.disabled = false;
            generateLinkBtn.title = '';
            generateLinkBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            generateLinkBtn.classList.add('hover:bg-indigo-600');

            // Show/hide the button based on whether there are items
            if (currentWishlist && currentWishlist.length > 0) {
                generateLinkBtn.classList.remove('hidden');
            } else {
                generateLinkBtn.classList.add('hidden');
            }
        }

        // Show the reset form button in create mode, but only if there are items
        const resetFormBtn = document.getElementById('reset-form-btn');
        if (resetFormBtn) {
            if (currentWishlist && currentWishlist.length > 0) {
                resetFormBtn.classList.remove('hidden');
            } else {
                resetFormBtn.classList.add('hidden');
            }
        }

        // Adjust the right section to use 2/3 width when left section is visible
        const rightSection = document.getElementById('right-section');
        if (rightSection) {
            rightSection.classList.remove('w-full');
            rightSection.classList.add('lg:w-2/3');
        }
    } else if (wishlistId) {
        // Auto-load the wishlist if ID is present in URL
        if (isCreatorView) {
            // For creator view (/lists/:listId), show creation section only, hide display section
            document.getElementById('home-page').classList.add('hidden');
            document.getElementById('create-section').classList.remove('hidden');
            document.getElementById('create-wishlist').classList.remove('hidden');
            document.getElementById('display-wishlist').classList.add('hidden');

            // Show the current wishlist section on creator view
            document.getElementById('current-wishlist').classList.remove('hidden');

            // Show the flex container that holds the create sections
            const createWishlistParent = document.getElementById('create-wishlist').parentElement;
            if (createWishlistParent) {
                createWishlistParent.classList.remove('hidden');
            }

            // Adjust the right section to use 2/3 width when left section is visible
            const rightSection = document.getElementById('right-section');
            if (rightSection) {
                rightSection.classList.remove('w-full');
                rightSection.classList.add('lg:w-2/3');
            }

            // Keep generate link button enabled for creator (they can update the share link)
            const generateLinkBtn = document.getElementById('generate-link-btn');
            if (generateLinkBtn) {
                generateLinkBtn.disabled = false;
                generateLinkBtn.title = '';
                generateLinkBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                generateLinkBtn.classList.add('hover:bg-indigo-600');

                // Show/hide the button based on whether there are items
                if (currentWishlist && currentWishlist.length > 0) {
                    generateLinkBtn.classList.remove('hidden');
                } else {
                    generateLinkBtn.classList.add('hidden');
                }
            }

            // Show the reset form button for creator
            const resetFormBtn = document.getElementById('reset-form-btn');
            if (resetFormBtn) {
                resetFormBtn.classList.remove('hidden');
            }
        } else {
            // For guest view (/lists/:listId/check or legacy formats), hide creation and show view
            document.getElementById('home-page').classList.add('hidden');
            document.getElementById('create-section').classList.add('hidden');
            document.getElementById('create-wishlist').classList.add('hidden');
            document.getElementById('display-wishlist').classList.remove('hidden');

            // Also hide the current wishlist section on guest view
            document.getElementById('current-wishlist').classList.add('hidden');

            // Hide the flex container that holds the create sections
            const createWishlistParent = document.getElementById('create-wishlist').parentElement;
            if (createWishlistParent) {
                createWishlistParent.classList.add('hidden');
            }

            // Adjust the right section to take full width when left section is hidden
            const rightSection = document.getElementById('right-section');
            if (rightSection) {
                rightSection.classList.remove('lg:w-2/3');
                rightSection.classList.add('w-full');
            }

            // Hide the generate link button in guest view mode
            const generateLinkBtn = document.getElementById('generate-link-btn');
            if (generateLinkBtn) {
                generateLinkBtn.classList.add('hidden');
            }

            // Hide the reset form button in guest view mode
            const resetFormBtn = document.getElementById('reset-form-btn');
            if (resetFormBtn) {
                resetFormBtn.classList.add('hidden');
            }
        }

        loadWishlistById(wishlistId);
    } else {
        // Default fallback - show creation interface
        document.getElementById('home-page').classList.add('hidden');
        document.getElementById('create-section').classList.remove('hidden');
        document.getElementById('create-wishlist').classList.remove('hidden');
        document.getElementById('display-wishlist').classList.add('hidden');
        document.getElementById('statistics-section').classList.add('hidden');

        // Show the current wishlist section in default create mode
        document.getElementById('current-wishlist').classList.remove('hidden');

        // Show the flex container that holds the create sections
        const createWishlistParent = document.getElementById('create-wishlist').parentElement;
        if (createWishlistParent) {
            createWishlistParent.classList.remove('hidden');
        }

        // Ensure generate link button is enabled in create mode
        const generateLinkBtn = document.getElementById('generate-link-btn');
        if (generateLinkBtn) {
            generateLinkBtn.disabled = false;
            generateLinkBtn.title = '';
            generateLinkBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            generateLinkBtn.classList.add('hover:bg-indigo-600');

            // Show/hide the button based on whether there are items
            if (currentWishlist && currentWishlist.length > 0) {
                generateLinkBtn.classList.remove('hidden');
            } else {
                generateLinkBtn.classList.add('hidden');
            }
        }

        // Show the reset form button in create mode, but only if there are items
        const resetFormBtn = document.getElementById('reset-form-btn');
        if (resetFormBtn) {
            if (currentWishlist && currentWishlist.length > 0) {
                resetFormBtn.classList.remove('hidden');
            } else {
                resetFormBtn.classList.add('hidden');
            }
        }

        // Adjust the right section to use 2/3 width when left section is visible
        const rightSection = document.getElementById('right-section');
        if (rightSection) {
            rightSection.classList.remove('w-full');
            rightSection.classList.add('lg:w-2/3');
        }
    }
});

// Also handle popstate events to maintain state when navigating back/forward
window.addEventListener('popstate', function(event) {
    // Reload the page content based on the current URL
    const currentPath = window.location.pathname;
    const pathParts = currentPath.split('/');
    let wishlistId = null;
    let isCreatorView = false;

    if (pathParts.includes('lists')) {
        const listsIndex = pathParts.indexOf('lists');
        if (pathParts[listsIndex + 1] && pathParts[listsIndex + 1] !== 'check') {
            wishlistId = pathParts[listsIndex + 1];
            if (pathParts[listsIndex + 2] !== 'check') {
                isCreatorView = true;
            }
        }
    }

    // Handle different page views based on URL
    if (currentPath === '/') {
        // Home page - show welcome screen with create button, hide other sections
        document.getElementById('home-page').classList.remove('hidden');
        document.getElementById('create-section').classList.add('hidden');
        document.getElementById('create-wishlist').classList.add('hidden');
        document.getElementById('display-wishlist').classList.add('hidden');
        document.getElementById('statistics-section').classList.add('hidden');
    } else if (currentPath === '/lists') {
        // Lists creation page - show the creation interface, hide homepage
        document.getElementById('home-page').classList.add('hidden');
        document.getElementById('create-section').classList.remove('hidden');
        document.getElementById('create-wishlist').classList.remove('hidden');
        document.getElementById('display-wishlist').classList.add('hidden');
        document.getElementById('statistics-section').classList.add('hidden');
    } else if (wishlistId) {
        if (isCreatorView) {
            // For creator view, show creation section and hide display section
            document.getElementById('create-section').classList.remove('hidden');
            document.getElementById('create-wishlist').classList.remove('hidden');
            document.getElementById('display-wishlist').classList.add('hidden');

            // Show the current wishlist section on creator view
            document.getElementById('current-wishlist').classList.remove('hidden');

            // Show the flex container that holds the create sections
            const createWishlistParent = document.getElementById('create-wishlist').parentElement;
            if (createWishlistParent) {
                createWishlistParent.classList.remove('hidden');
            }

            // Adjust the right section to use 2/3 width when left section is visible
            const rightSection = document.getElementById('right-section');
            if (rightSection) {
                rightSection.classList.remove('w-full');
                rightSection.classList.add('lg:w-2/3');
            }
        } else {
            // For guest view, hide creation section and show display section
            document.getElementById('create-section').classList.add('hidden');
            document.getElementById('create-wishlist').classList.add('hidden');
            document.getElementById('display-wishlist').classList.remove('hidden');

            // Hide the current wishlist section on guest view
            document.getElementById('current-wishlist').classList.add('hidden');

            // Hide the flex container that holds the create sections
            const createWishlistParent = document.getElementById('create-wishlist').parentElement;
            if (createWishlistParent) {
                createWishlistParent.classList.add('hidden');
            }

            // Adjust the right section to take full width when left section is hidden
            const rightSection = document.getElementById('right-section');
            if (rightSection) {
                rightSection.classList.remove('lg:w-2/3');
                rightSection.classList.add('w-full');
            }
        }

        // Refresh the view
        loadWishlistById(wishlistId);
    } else {
        // Default fallback - show creation interface
        document.getElementById('home-page').classList.add('hidden');
        document.getElementById('create-section').classList.remove('hidden');
        document.getElementById('create-wishlist').classList.remove('hidden');
        document.getElementById('display-wishlist').classList.add('hidden');
        document.getElementById('statistics-section').classList.add('hidden');

        // Show the current wishlist section in default create mode
        document.getElementById('current-wishlist').classList.remove('hidden');

        // Show the flex container that holds the create sections
        const createWishlistParent = document.getElementById('create-wishlist').parentElement;
        if (createWishlistParent) {
            createWishlistParent.classList.remove('hidden');
        }

        // Adjust the right section to use 2/3 width when left section is visible
        const rightSection = document.getElementById('right-section');
        if (rightSection) {
            rightSection.classList.remove('w-full');
            rightSection.classList.add('lg:w-2/3');
        }
    }
});

// Function to load wishlist by ID directly
async function loadWishlistById(wishlistId) {
    try {
        // Load the wishlist from the server using the shareToken
        const response = await fetch(`/api/lists/${wishlistId}`);
        const wishlistData = await response.json();

        if (response.ok) {
            // Display the loaded wishlist
            displayWishlistFromServer(wishlistData, wishlistId);

            // If this is a creator view, also populate the currentWishlist array
            // so the creator can see their items and add more
            const pathParts = window.location.pathname.split('/');
            if (pathParts.includes('lists')) {
                const listsIndex = pathParts.indexOf('lists');
                if (pathParts[listsIndex + 1] && pathParts[listsIndex + 1] === wishlistId && pathParts[listsIndex + 2] !== 'check') {
                    // This is creator view, populate the currentWishlist
                    currentWishlist = wishlistData.goods.map(good => ({
                        id: good.id.toString(),
                        name: good.name,
                        link: good.url,
                        price: good.price ? parseFloat(good.price) : null,
                        image: good.imageUrl,
                        bookedBy: good.reservedByGuest ? good.reservedByGuest.name : null
                    }));

                    // Store the list ID and share token for future updates
                    currentWishlistId = wishlistData.id;
                    currentWishlistShareToken = wishlistData.shareToken;

                    // Render the current wishlist in the creation interface
                    renderCurrentWishlist();

                    // Set the person's name to the creator's name
                    personNameInput.value = wishlistData.creator.name;

                    // Show the share link for the current list and update URL if needed
                    if (currentWishlistShareToken) {
                        const shareableLink = `${window.location.origin}/lists/${currentWishlistShareToken}/check`;

                        // Update the URL to the owner's view (without /check) for the owner
                        const ownerUrl = `${window.location.origin}/lists/${currentWishlistShareToken}`;
                        if (!window.location.pathname.includes(currentWishlistShareToken) || window.location.pathname.endsWith('/check')) {
                            window.history.replaceState({}, '', ownerUrl);
                        }

                        shareLinkInput.value = shareableLink;
                        shareLinkContainer.classList.remove('hidden');
                    }
                }
            }
        } else {
            console.error('Wishlist not found:', wishlistData.error);
        }
    } catch (error) {
        console.error('Error loading wishlist by ID:', error);
    }
}

