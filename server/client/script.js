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
const generateLinkBtn = document.getElementById('generate-link-btn');
const shareLinkContainer = document.getElementById('share-link-container');
const shareLinkInput = document.getElementById('share-link');
const copyLinkBtn = document.getElementById('copy-link-btn');
const viewLinkInput = document.getElementById('view-link');
const loadWishlistBtn = document.getElementById('load-wishlist-btn');
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
let currentWishlistId = null;
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
    
    // Show the statistics section initially
    document.getElementById('statistics-section').style.display = 'block';
    updateStatistics(); // Initialize stats
});

function setupEventListeners() {
    // Wishlist form submission
    wishlistForm.addEventListener('submit', addItemToWishlist);
    
    // Generate shareable link
    generateLinkBtn.addEventListener('click', generateShareableLink);
    
    // Copy link button
    copyLinkBtn.addEventListener('click', copyShareableLink);
    
    // Load wishlist button
    loadWishlistBtn.addEventListener('click', loadWishlistFromLink);
    
    // Modal close button
    closeModal.addEventListener('click', closeBookingModal);
    
    // Confirm booking button
    confirmBookingBtn.addEventListener('click', confirmBooking);
    
    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === bookingModal) {
            closeBookingModal();
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
        }
    } catch (error) {
        console.error('Error fetching product info:', error);
        linkStatusDiv.innerHTML = '<span class="text-red-400">⚠️ Error retrieving product info. Please enter manually.</span>';
        linkStatusDiv.classList.remove('hidden');

        // Hide image preview on error
        if (previewImageContainer) {
            previewImageContainer.classList.add('hidden');
        }
    } finally {
        // Hide loading indicator
        linkLoadingDiv.classList.add('hidden');
    }
}

// Function to paste URL from clipboard
async function pasteFromClipboard() {
    try {
        // Check if Clipboard API is supported
        if (navigator.clipboard && navigator.clipboard.readText) {
            const clipboardText = await navigator.clipboard.readText();

            // Check if clipboard contains a valid URL
            const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

            if (urlPattern.test(clipboardText)) {
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
            // Show message if Clipboard API is not supported
            linkStatusDiv.innerHTML = `<span class="text-red-400">⚠️ Clipboard API not supported in your browser</span>`;
            linkStatusDiv.classList.remove('hidden');
        }
    } catch (err) {
        // Show error message
        linkStatusDiv.innerHTML = `<span class="text-red-400">⚠️ Could not access clipboard: ${err.message}</span>`;
        linkStatusDiv.classList.remove('hidden');
        console.log('Could not access clipboard:', err);
    }
}

// Helper function to extract numeric price value from price string
function extractPriceValue(priceString) {
    if (!priceString) return null;

    console.log('Processing price string:', priceString);

    // Handle Ukrainian/Russian price formats (with spaces as thousand separators)
    // Remove common currency symbols and non-numeric characters, keeping decimal points and commas
    let cleanedPrice = priceString
        .replace(/[^\d\s,.]/g, '')  // Keep only digits, spaces, dots, commas
        .trim();

    console.log('Cleaned price string:', cleanedPrice);

    // Handle different decimal separators (comma vs dot)
    // If there are multiple commas and only one dot, comma might be a thousands separator
    const commaCount = (cleanedPrice.match(/,/g) || []).length;
    const dotCount = (cleanedPrice.match(/\./g) || []).length;

    if (commaCount > 1 && dotCount <= 1) {
        // Commas are likely thousands separators, remove them
        cleanedPrice = cleanedPrice.replace(/,/g, '');
    } else if (commaCount === 1 && dotCount >= 0) {
        // Comma might be decimal separator, replace with dot
        cleanedPrice = cleanedPrice.replace(/,/g, '.');
    }

    // Remove spaces (thousands separators in Ukrainian/Russian formats)
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
function addItemToWishlist(e) {
    if (e) e.preventDefault();

    const personName = personNameInput.value.trim();
    const itemName = itemNameInput.value.trim();
    const itemLink = itemLinkInput.value.trim();
    const itemPrice = itemPriceInput.value.trim();

    if (!personName || !itemName) {
        alert('Please fill in the required fields');
        return;
    }

    const newItem = {
        id: Date.now().toString(),
        name: itemName,
        link: itemLink,
        price: itemPrice ? parseFloat(itemPrice) : null,
        image: itemLinkInput.dataset.image || null, // Store image from extraction
        bookedBy: null
    };

    currentWishlist.push(newItem);
    renderCurrentWishlist();

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
        linkStatusDiv.innerHTML = lastRetrievedMessage + ' <span class="text-green-400">✓ Added to wishlist!</span>';
    } else {
        linkStatusDiv.innerHTML = '<span class="text-green-400">✓ Item added to wishlist!</span>';
    }
    linkStatusDiv.classList.remove('hidden');

    // Reset auto-add flag after item is added
    autoAddEnabled = false;
}

// Render the current wishlist
function renderCurrentWishlist() {
    wishlistItemsGrid.innerHTML = '';

    if (currentWishlist.length === 0) {
        wishlistItemsGrid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">No items yet</div>';
        updateStatistics(); // Update stats when list is empty
        return;
    }

    currentWishlist.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'wishlist-item glass-card p-4 rounded-xl bg-white/10 border border-white/20 flex flex-col';
        card.dataset.itemId = item.id;

        let priceDisplay = '';
        if (item.price) {
            priceDisplay = `<div class="text-purple-300 font-medium">Price: $${item.price.toFixed(2)}</div>`;
        }

        let linkDisplay = '';
        if (item.link) {
            linkDisplay = `<a href="${item.link}" target="_blank" class="text-blue-300 hover:text-blue-200 text-sm block truncate">View Item</a>`;
        }

        let imageDisplay = '';
        if (item.image) {
            imageDisplay = `<img src="${item.image}" alt="${item.name}" class="w-full h-32 object-contain rounded-lg mb-2" onerror="this.style.display='none';">`;
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
                            <button class="remove-btn w-full glass-button py-1.5 rounded text-white text-xs hover:bg-white/25 transition-all label-contrast" data-index="${index}">
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event listener to remove button
        const removeBtn = card.querySelector('.remove-btn');
        removeBtn.addEventListener('click', function() {
            currentWishlist.splice(index, 1);
            renderCurrentWishlist();
        });

        wishlistItemsGrid.appendChild(card);
    });

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
        alert('Please add at least one item to your wishlist');
        return;
    }

    const personName = personNameInput.value.trim();
    if (!personName) {
        alert('Please enter your name');
        return;
    }

    try {
        // Show loading state
        const originalBtnText = generateLinkBtn.textContent;
        generateLinkBtn.textContent = 'Generating...';
        generateLinkBtn.disabled = true;

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
            // Add items to the list
            for (const item of currentWishlist) {
                if (item.link) {
                    // Add item to the server list from URL
                    await fetch('/api/goods', {
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
                    await fetch('/api/goods', {
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
            }

            // Use the new shareable link format
            const shareableLink = result.shareableLink;

            shareLinkInput.value = shareableLink;
            shareLinkContainer.classList.remove('hidden');

            // Show success message
            linkStatusDiv.innerHTML = `<span class="text-green-400">✓ Shareable link generated! Send this to others.</span>`;
            linkStatusDiv.classList.remove('hidden');
        } else {
            throw new Error(result.error || 'Failed to create wishlist');
        }
    } catch (error) {
        console.error('Error generating shareable link:', error);
        alert('Error generating shareable link: ' + error.message);
    } finally {
        // Restore button state
        generateLinkBtn.textContent = 'Generate Shareable Link';
        generateLinkBtn.disabled = false;
    }
}

// Copy the shareable link to clipboard
function copyShareableLink() {
    shareLinkInput.select();
    document.execCommand('copy');
    
    // Show feedback
    const originalText = copyLinkBtn.textContent;
    copyLinkBtn.textContent = 'Copied!';
    setTimeout(() => {
        copyLinkBtn.textContent = originalText;
    }, 2000);
}

// Load wishlist from a shared link
async function loadWishlistFromLink() {
    const link = viewLinkInput.value.trim();
    if (!link) {
        alert('Please enter a wishlist link');
        return;
    }

    try {
        // Extract wishlist ID from the URL
        // Support both formats: /?wishlist=ID and /wishlist/ID
        let wishlistId = null;

        // Check for the old format: ?wishlist=ID
        const urlParams = new URLSearchParams(link.split('?')[1]);
        wishlistId = urlParams.get('wishlist');

        // If not found in query params, check for the new format: /wishlist/ID
        if (!wishlistId) {
            const pathParts = link.split('/');
            if (pathParts.includes('wishlist')) {
                const wishlistIndex = pathParts.indexOf('wishlist');
                if (pathParts[wishlistIndex + 1]) {
                    wishlistId = pathParts[wishlistIndex + 1];
                }
            }
        }

        if (!wishlistId) {
            alert('Invalid wishlist link');
            return;
        }

        // Load the wishlist from the server
        const response = await fetch(`/api/lists/${wishlistId}`);
        const wishlistData = await response.json();

        if (response.ok) {
            // Display the loaded wishlist
            displayWishlistFromServer(wishlistData, wishlistId);
        } else {
            alert('Wishlist not found: ' + wishlistData.error);
        }
    } catch (error) {
        console.error('Error loading wishlist:', error);
        alert('Error loading wishlist: ' + error.message);
    }
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

    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `wishlist-item glass-card p-4 rounded-xl ${item.bookedBy ? 'booked-item' : ''}`;
        card.dataset.itemId = item.id;

        let priceDisplay = '';
        if (item.price) {
            priceDisplay = `<div class="text-purple-300 font-medium label-contrast">Price: $${item.price.toFixed(2)}</div>`;
        }

        let linkDisplay = '';
        if (item.link) {
            linkDisplay = `<a href="${item.link}" target="_blank" class="text-blue-300 hover:text-blue-200 text-sm block truncate label-contrast">View Item</a>`;
        }

        let imageDisplay = '';
        if (item.image) {
            imageDisplay = `<img src="${item.image}" alt="${item.name}" class="w-full h-32 object-contain rounded-lg mb-2" onerror="this.style.display='none';">`;
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
            <div class="flex flex-col h-full">
                ${imageDisplay}
                <div class="flex-1 flex flex-col justify-between">
                    <div>
                        <div class="font-medium text-white text-sm mb-1 line-clamp-2 label-contrast">${item.name}</div>
                        ${priceDisplay}
                        ${linkDisplay}
                        ${bookerDisplay}
                    </div>
                    <div class="mt-2">
                        <button class="book-btn w-full py-1.5 rounded text-white text-xs transition-all ${buttonClass} label-contrast"
                                data-item-id="${item.id}"
                                data-wishlist-id="${wishlistId}"
                                ${item.bookedBy ? 'disabled' : ''}>
                            ${item.bookedBy ? 'Booked' : 'Book Item'}
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

    displayWishlistSection.classList.remove('hidden');

    // Update statistics for the displayed wishlist
    updateDisplayStatistics(items);

    // Show the statistics section
    document.getElementById('statistics-section').classList.remove('hidden');

    // Scroll to the wishlist section
    displayWishlistSection.scrollIntoView({ behavior: 'smooth' });
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

    wishlistData.items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `wishlist-item glass-card p-4 rounded-xl ${item.bookedBy ? 'booked-item' : ''}`;
        card.dataset.itemId = item.id;

        let priceDisplay = '';
        if (item.price) {
            priceDisplay = `<div class="text-purple-300 font-medium label-contrast">Price: $${item.price.toFixed(2)}</div>`;
        }

        let linkDisplay = '';
        if (item.link) {
            linkDisplay = `<a href="${item.link}" target="_blank" class="text-blue-300 hover:text-blue-200 text-sm block truncate label-contrast">View Item</a>`;
        }

        let imageDisplay = '';
        if (item.image) {
            imageDisplay = `<img src="${item.image}" alt="${item.name}" class="w-full h-32 object-contain rounded-lg mb-2" onerror="this.style.display='none';">`;
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
            <div class="flex flex-col h-full">
                ${imageDisplay}
                <div class="flex-1 flex flex-col justify-between">
                    <div>
                        <div class="font-medium text-white text-sm mb-1 line-clamp-2 label-contrast">${item.name}</div>
                        ${priceDisplay}
                        ${linkDisplay}
                        ${bookerDisplay}
                    </div>
                    <div class="mt-2">
                        <button class="book-btn w-full py-1.5 rounded text-white text-xs transition-all ${buttonClass} label-contrast"
                                data-item-id="${item.id}"
                                data-wishlist-id="${wishlistId}"
                                ${item.bookedBy ? 'disabled' : ''}>
                            ${item.bookedBy ? 'Booked' : 'Book Item'}
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
    
    bookingModal.classList.remove('hidden');
}

// Close booking modal
function closeBookingModal() {
    bookingModal.classList.add('hidden');
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

        // Update the item on the server
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
    } catch (error) {
        console.error('Error booking item:', error);
        alert('Error booking item: ' + error.message);
    }
}

// Check if there's a wishlist ID in the URL on page load
window.addEventListener('load', function() {
    // Check for the new URL format: /wishlist/ID
    const pathParts = window.location.pathname.split('/');
    let wishlistId = null;

    if (pathParts.includes('wishlist')) {
        const wishlistIndex = pathParts.indexOf('wishlist');
        if (pathParts[wishlistIndex + 1]) {
            wishlistId = pathParts[wishlistIndex + 1];
        }
    }

    // If not found in path, check for the old format: ?wishlist=ID
    if (!wishlistId) {
        const urlParams = new URLSearchParams(window.location.search);
        wishlistId = urlParams.get('wishlist');
    }

    if (wishlistId) {
        // Auto-load the wishlist if ID is present in URL
        // Hide the create section and show the view section for guests
        document.getElementById('create-wishlist').style.display = 'none';
        document.getElementById('view-wishlist').style.display = 'block';

        loadWishlistById(wishlistId);
    } else {
        // If no wishlist ID in URL, show create section (default behavior)
        document.getElementById('create-wishlist').style.display = 'block';
        document.getElementById('view-wishlist').style.display = 'block';
    }
});

// Function to load wishlist by ID directly
async function loadWishlistById(wishlistId) {
    try {
        // Load the wishlist from the server using the shareToken
        const response = await fetch(`/api/lists/${wishlistId}`);
        const wishlistData = await response.json();

        if (response.ok) {
            // The create section is already hidden by the load event
            viewLinkInput.value = window.location.href;

            // Display the loaded wishlist
            displayWishlistFromServer(wishlistData, wishlistId);
        } else {
            console.error('Wishlist not found:', wishlistData.error);
        }
    } catch (error) {
        console.error('Error loading wishlist by ID:', error);
    }
}