// Configuration
const CONFIG = {
    apiUrl: 'https://api.apartantibes.com/',
    building: 'a1',
    apartment: 'a2'
};

// Parse text date like "30 April 2026" into YYYY-MM-DD
function parseTextDate(dateStr) {
    if (!dateStr) return null;
    
    const months = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12',
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09',
        'oct': '10', 'nov': '11', 'dec': '12'
    };
    
    const cleaned = dateStr.toLowerCase().trim().replace(/,/g, '');
    const parts = cleaned.split(/\s+/);
    
    let day, month, year;
    
    for (const part of parts) {
        if (months[part]) {
            month = months[part];
        } else if (/^\d{4}$/.test(part)) {
            year = part;
        } else if (/^\d{1,2}$/.test(part)) {
            day = part.padStart(2, '0');
        }
    }
    
    if (day && month && year) {
        return `${year}-${month}-${day}`;
    }
    return null;
}

// Try to get dates from URL parameters (handles broken links with spaces)
function getDatesFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Try 'in' and 'out' parameters
    let checkin = urlParams.get('in');
    let checkout = urlParams.get('out');
    
    // If not found, try 'checkin' and 'checkout'
    if (!checkin) checkin = urlParams.get('checkin');
    if (!checkout) checkout = urlParams.get('checkout');
    
    // If still not found, try parsing from the raw URL
    if (!checkin || !checkout) {
        const fullUrl = decodeURIComponent(window.location.href);
        
        // Try to match "in=..." or "checkin=..."
        const inMatch = fullUrl.match(/(?:in|checkin)=([^&]+)/i);
        const outMatch = fullUrl.match(/(?:out|checkout)=([^&]+)/i);
        
        if (inMatch) checkin = inMatch[1];
        if (outMatch) checkout = outMatch[1];
    }
    
    if (checkin && checkout) {
        const checkinStr = parseTextDate(checkin);
        const checkoutStr = parseTextDate(checkout);
        
        if (checkinStr && checkoutStr) {
            return { checkinStr, checkoutStr };
        }
    }
    
    return null;
}

// Current dates
let currentDates = null;

// Access reference from URL
let accessRef = null;

// Extract access ref from URL
function getRefFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('_bref');
}

// Get token from URL or show form if needed
async function initializeAccess() {
    const buttonContainer = document.getElementById('buttonContainer');
    const dateForm = document.getElementById('dateForm');
    const dateFormTitle = document.getElementById('dateFormTitle');
    const dateFormSubtitle = document.getElementById('dateFormSubtitle');
    const checkinInput = document.getElementById('checkinDate');
    const checkoutInput = document.getElementById('checkoutDate');
    
    // Extract access ref
    accessRef = getRefFromUrl();
    
    if (!accessRef) {
        // No ref - show error
        dateForm.classList.remove('visible');
        showStatus('❌ Invalid access link. Please use the link provided to you.', 'error');
        return;
    }
    
    // Try to get dates from URL
    const dates = getDatesFromUrl();
    
    if (dates) {
        // Pre-fill form
        checkinInput.value = dates.checkinStr;
        checkoutInput.value = dates.checkoutStr;
        
        dateFormTitle.textContent = '📅 Verify your dates';
        dateFormSubtitle.textContent = 'Please confirm your check-in and check-out dates';
        
        dateForm.classList.add('visible');
    } else {
        // Show empty form
        dateFormTitle.textContent = '📅 Enter your dates';
        dateFormSubtitle.textContent = 'Please enter your check-in and check-out dates';
        
        dateForm.classList.add('visible');
    }
}

// Handle date form submission
async function handleDateFormSubmit() {
    const checkinInput = document.getElementById('checkinDate');
    const checkoutInput = document.getElementById('checkoutDate');
    
    if (!checkinInput.value || !checkoutInput.value) {
        showStatus('⚠️ Please enter both check-in and check-out dates.', 'error');
        return;
    }
    
    const checkinStr = checkinInput.value; // Already in YYYY-MM-DD format
    const checkoutStr = checkoutInput.value;
    
    // Validate dates
    const checkin = new Date(checkinStr);
    const checkout = new Date(checkoutStr);
    
    if (checkout <= checkin) {
        showStatus('⚠️ Check-out must be after check-in.', 'error');
        return;
    }
    
    // Store dates (token will be generated server-side)
    currentDates = { checkin: checkinStr, checkout: checkoutStr };
    console.log('Dates confirmed:', currentDates);
    
    // Enable buttons (keep form visible)
    document.getElementById('buildingBtn').disabled = false;
    document.getElementById('apartmentBtn').disabled = false;
    
    showStatus('✓ Dates confirmed! You can now open the door.', 'success');
}

// Show status message
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Trigger action
async function actionHandler(webhookId, buttonElement, doorName) {
    if (!currentDates) {
        showStatus('❌ Please enter your booking dates first.', 'error');
        return;
    }

    // Disable button and show loading
    buttonElement.disabled = true;
    const originalContent = buttonElement.innerHTML;
    buttonElement.innerHTML = '<span class="spinner"></span><span>Opening...</span>';

    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                webhookId, 
                checkin: currentDates.checkin, 
                checkout: currentDates.checkout,
                bref: accessRef
            })
        });

        if (response.ok) {
            showStatus(`✅ ${doorName}: request sent.`, 'success');
        } else {
            showStatus(`❌ ${doorName}: request failed. Please try again or contact your administrator.`, 'error');
        }
        
    } catch (error) {
        console.error('Error triggering webhook:', error);
        showStatus(`❌ Connection failed. Please check your internet connection.`, 'error');
    } finally {
        // Re-enable button
        setTimeout(() => {
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalContent;
        }, 2000);
    }
}

// Event listeners
document.getElementById('buildingBtn').addEventListener('click', function() {
    actionHandler(CONFIG.building, this, 'Building');
});

document.getElementById('apartmentBtn').addEventListener('click', function() {
    actionHandler(CONFIG.apartment, this, 'Apartment');
});

document.getElementById('confirmDates').addEventListener('click', handleDateFormSubmit);

// Initialize on page load
window.addEventListener('load', initializeAccess);
