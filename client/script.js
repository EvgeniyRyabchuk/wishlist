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
const previewImageContainer = document.getElementById('product-image-preview');
const previewImage = document.getElementById('preview-image');

// Statistics elements
const totalBudgetEl = document.getElementById('total-budget');
const totalItemsEl = document.getElementById('total-items');
const bookedItemsEl = document.getElementById('booked-items');
const availableItemsEl = document.getElementById('available-items');

// Global variables
let currentWishlist = [];
let currentWishlistId = null;
let lastRetrievedMessage = null;

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

                // Show the image preview
                previewImage.src = productInfo.image;
                console.log('Setting image src to:', productInfo.image);
                
                // Show the preview container
                previewImageContainer.classList.remove('hidden');
                
                // Handle image loading success
                previewImage.onload = function() {
                    console.log('Image loaded successfully:', productInfo.image);
                };

                // Handle image loading error
                previewImage.onerror = function() {
                    console.log('Failed to load image:', productInfo.image);
                    previewImageContainer.classList.add('hidden');
                };
            } else {
                console.log('No image found in product info');
                // Hide the preview if no image was found
                previewImageContainer.classList.add('hidden');
            }

            // Store the retrieved message for potential restoration after form submission
            if (productInfo.title && !productInfo.title.includes(urlObj.hostname)) {
                lastRetrievedMessage = `<span class="text-green-400">✓ Retrieved: ${productInfo.title}</span>`;
            } else {
                lastRetrievedMessage = `<span class="text-orange-400">ℹ️ Could not extract specific product info from ${urlObj.hostname}. Please enter manually.</span>`;
            }

            linkStatusDiv.innerHTML = lastRetrievedMessage;
            linkStatusDiv.classList.remove('hidden');
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
        previewImageContainer.classList.add('hidden');
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
                
                // Start the product info extraction
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
    e.preventDefault();
    
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
    previewImageContainer.classList.add('hidden');
    // Show a confirmation message or restore the retrieved message
    if (lastRetrievedMessage) {
        // Keep the retrieved message and append the addition confirmation
        linkStatusDiv.innerHTML = lastRetrievedMessage + ' <span class="text-green-400">✓ Added to wishlist!</span>';
    } else {
        linkStatusDiv.innerHTML = '<span class="text-green-400">✓ Item added to wishlist!</span>';
    }
    linkStatusDiv.classList.remove('hidden');
}

// Render the current wishlist
function renderCurrentWishlist() {
    wishlistItemsGrid.innerHTML = '';
    
    if (currentWishlist.length === 0) {
        wishlistItemsGrid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">No items added yet</div>';
        updateStatistics(); // Update stats when list is empty
        return;
    }
    
    currentWishlist.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'wishlist-item glass-card p-4 rounded-xl bg-white/10 border border-white/20';
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
            imageDisplay = `<img src="${item.image}" alt="${item.name}" class="w-full h-32 object-cover rounded-lg mb-2" onerror="this.style.display='none';">`;
        }
        
        card.innerHTML = `
            <div class="flex flex-col h-full">
                ${imageDisplay}
                <div class="flex-1">
                    <div class="font-medium text-white text-lg mb-1">${item.name}</div>
                    ${priceDisplay}
                    ${linkDisplay}
                </div>
                <div class="mt-3 pt-3 border-t border-white/10">
                    <button class="remove-btn w-full glass-button py-2 rounded-lg text-white text-sm hover:bg-white/25 transition-all" data-index="${index}">
                        Remove
                    </button>
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

// Generate a shareable link for the wishlist
function generateShareableLink() {
    if (currentWishlist.length === 0) {
        alert('Please add at least one item to your wishlist');
        return;
    }
    
    const personName = personNameInput.value.trim();
    if (!personName) {
        alert('Please enter your name');
        return;
    }
    
    // Save the wishlist to localStorage
    currentWishlistId = 'wishlist_' + Date.now().toString();
    const wishlistData = {
        owner: personName,
        items: currentWishlist,
        createdAt: new Date().toISOString()
    };
    
    const allWishlists = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '{}');
    allWishlists[currentWishlistId] = wishlistData;
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(allWishlists));
    
    // Generate the shareable link
    const currentUrl = window.location.href.split('?')[0];
    const shareableLink = `${currentUrl}?wishlist=${currentWishlistId}`;
    
    shareLinkInput.value = shareableLink;
    shareLinkContainer.classList.remove('hidden');
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
function loadWishlistFromLink() {
    const link = viewLinkInput.value.trim();
    if (!link) {
        alert('Please enter a wishlist link');
        return;
    }
    
    // Extract wishlist ID from the URL
    const urlParams = new URLSearchParams(link.split('?')[1]);
    const wishlistId = urlParams.get('wishlist');
    
    if (!wishlistId) {
        alert('Invalid wishlist link');
        return;
    }
    
    // Load the wishlist from localStorage
    const allWishlists = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '{}');
    const wishlistData = allWishlists[wishlistId];
    
    if (!wishlistData) {
        alert('Wishlist not found');
        return;
    }
    
    // Display the loaded wishlist
    displayWishlist(wishlistData, wishlistId);
}

// Display the loaded wishlist
function displayWishlist(wishlistData, wishlistId) {
    ownerNameSpan.textContent = wishlistData.owner;
    displayItemsGrid.innerHTML = '';
    
    wishlistData.items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `wishlist-item glass-card p-4 rounded-xl ${item.bookedBy ? 'booked-item' : ''}`;
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
            imageDisplay = `<img src="${item.image}" alt="${item.name}" class="w-full h-32 object-cover rounded-lg mb-2" onerror="this.style.display='none';">`;
        }
        
        let bookerDisplay = '';
        if (item.bookedBy) {
            bookerDisplay = `<div class="text-green-300 text-sm mb-2">Booked by: ${item.bookedBy}</div>`;
        }
        
        card.innerHTML = `
            <div class="flex flex-col h-full">
                ${imageDisplay}
                <div class="flex-1">
                    <div class="font-medium text-white text-lg mb-1">${item.name}</div>
                    ${priceDisplay}
                    ${linkDisplay}
                    ${bookerDisplay}
                </div>
                <div class="mt-3 pt-3 border-t border-white/10">
                    <button class="book-btn w-full py-2 rounded-lg text-white text-sm transition-all ${item.bookedBy ? 'bg-gray-500 cursor-not-allowed' : 'glass-button hover:bg-white/25'}" 
                            data-item-id="${item.id}" 
                            data-wishlist-id="${wishlistId}"
                            ${item.bookedBy ? 'disabled' : ''}>
                        ${item.bookedBy ? 'Booked' : 'Book Item'}
                    </button>
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
function confirmBooking() {
    const itemId = bookingModal.dataset.itemId;
    const wishlistId = bookingModal.dataset.wishlistId;
    const bookerName = bookerNameInput.value.trim();
    
    if (!bookerName) {
        alert('Please enter your name');
        return;
    }
    
    // Save user's name to localStorage
    localStorage.setItem(USER_NAME_KEY, bookerName);
    
    // Update the wishlist in localStorage
    const allWishlists = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '{}');
    const wishlistData = allWishlists[wishlistId];
    
    if (!wishlistData) {
        alert('Wishlist not found');
        closeBookingModal();
        return;
    }
    
    // Find the item and update its bookedBy status
    const itemIndex = wishlistData.items.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
        wishlistData.items[itemIndex].bookedBy = bookerName;
        
        // Save updated wishlist back to localStorage
        allWishlists[wishlistId] = wishlistData;
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(allWishlists));
        
        // Update the displayed wishlist
        displayWishlist(wishlistData, wishlistId);
        
        // Close the modal
        closeBookingModal();
    } else {
        alert('Item not found');
    }
}

// Check if there's a wishlist ID in the URL on page load
window.addEventListener('load', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const wishlistId = urlParams.get('wishlist');
    
    if (wishlistId) {
        // Auto-load the wishlist if ID is present in URL
        const allWishlists = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '{}');
        const wishlistData = allWishlists[wishlistId];
        
        if (wishlistData) {
            // Hide the create section and show the view section
            document.getElementById('create-wishlist').style.display = 'none';
            viewLinkInput.value = window.location.href;
            
            // Display the loaded wishlist
            displayWishlist(wishlistData, wishlistId);
        }
    }
});