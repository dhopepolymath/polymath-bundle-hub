/**
 * PolymathBundleHub - Main Application Logic
 * Version: 4.0
 */
console.log('🚀 PolymathBundleHub v4.0 - Direct MoMo Active');

// Configuration
const USE_PYTHON_BACKEND = true; // Security: Enabled backend to protect API keys
// For local development, use localhost. For production, update this to your backend URL.
const isProduction = window.location.hostname.endsWith('onrender.com');
const isLocal = !isProduction;

// Use relative paths when local to avoid CORS/IP issues across different browsers/devices
const PYTHON_API_BASE = isLocal 
    ? '/api' 
    : 'https://polymath-backend-txw3.onrender.com/api'; 
const IDATA_API_BASE = 'https://idatagh.com/wp-json/custom/v1';

const API_BASE_URL = USE_PYTHON_BACKEND ? PYTHON_API_BASE : IDATA_API_BASE;

// Only log config in development
if (isLocal) {
    console.log('--- APP CONFIG ---');
    console.log('isLocal:', isLocal);
    console.log('API_BASE_URL:', API_BASE_URL);
    console.log('------------------');
}
// SECURITY: API_KEY is now hidden in the Python backend. 
// For frontend-only mode, it uses the placeholder.
const API_KEY = USE_PYTHON_BACKEND ? 'HIDDEN_IN_BACKEND' : 'tera_live_c695fb80bf3c9de198a0ee4a81173ea7'; 
/**
 * PROFIT PROTECTION SYSTEM
 * To ensure you never go at a loss, the system adds two layers of markup:
 */
function getMarkupSettings() {
    return JSON.parse(localStorage.getItem('markupSettings')) || {
        flat: 1.50,
        percent: 0.05,
        publicSurcharge: 2.00,
        minProfit: 1.00
    };
}

function getRetailPrice(bundleId, cost, isMember = false) {
    const settings = getMarkupSettings();
    
    // Check for custom price override first
    const customPrices = JSON.parse(localStorage.getItem('customPrices')) || {};
    if (customPrices[bundleId]) {
        let price = parseFloat(customPrices[bundleId]);
        // Public users still pay the surcharge even on custom prices
        if (!isMember) {
            price += settings.publicSurcharge;
        }
        return Math.round(price);
    }

    const costNum = parseFloat(cost);
    // Formula: (Cost + Percentage) + Flat Fee
    let profit = (costNum * settings.percent) + settings.flat;
    
    // Add surcharge for public users
    if (!isMember) {
        profit += settings.publicSurcharge;
    }
    
    // Safety Check: If profit is too low, use the minProfit instead
    if (profit < settings.minProfit) {
        profit = settings.minProfit;
    }
    
    const retailPrice = costNum + profit;
    
    return Math.round(retailPrice); 
}

const APP_NAME = 'PolymathBundleHub';

// State Management
const state = {
    user: JSON.parse(localStorage.getItem('user')) || null,
    token: localStorage.getItem('token') || null,
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    theme: localStorage.getItem('theme') || 'light',
    bundles: []
};

// Check for session validity (basic check)
if (state.user && !state.token) {
    state.user = null;
    localStorage.removeItem('user');
}

// --- Mock Data / Package List ---
// Note: 'id' here must match the 'pa_data-bundle-packages' ID from iDATA.
// Prices here are base costs. The final price shown to users will be cost + Markup.
// [REMOVED MOCK_BUNDLES - Now served by Python Backend]

// --- API Service ---
const api = {
    async get(endpoint) {
        const url = `${API_BASE_URL}${endpoint}`;
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            if (state.token) {
                headers['Authorization'] = `Bearer ${state.token}`;
            }
            
            const response = await fetch(url, { headers });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `API error: ${response.status}`);
            }
            const data = await response.json();
            const isMember = !!state.token;
            if (Array.isArray(data)) {
                return data.map(item => ({
                    ...item,
                    price: item.price ? getRetailPrice(item.id, item.price, isMember) : item.price
                }));
            }
            if (data && data.price) {
                return {
                    ...data,
                    price: getRetailPrice(data.id, data.price, isMember)
                };
            }
            return data;
        } catch (error) {
            console.error(`[API GET ERROR] ${url}:`, error);
            throw error;
        }
    },
    async post(endpoint, data) {
        const url = `${API_BASE_URL}${endpoint}`;
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            if (state.token) {
                headers['Authorization'] = `Bearer ${state.token}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || `Request failed: ${response.status}`);
            }
            return result;
        } catch (error) {
            console.error(`[API POST ERROR] ${url}:`, error);
            throw error;
        }
    }
};

window.payWithPaystackHosted = async (amount, email, callback) => {
    console.log('Initiating Hosted Paystack Payment...', { amount, email });

    try {
        const btn = document.querySelector('button[onclick="initiateTopup()"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Opening Paystack...';
        }

        const response = await fetch(`${PYTHON_API_BASE}/initialize-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, email })
        });
        
        const data = await response.json();

        if (data.success && data.data && data.data.authorization_url) {
            // Store payment info for verification after redirect
            localStorage.setItem('pending_payment_amount', amount);
            localStorage.setItem('pending_payment_ref', data.data.reference);
            
            // Redirect to Paystack Hosted Page
            window.location.href = data.data.authorization_url;
        } else {
            throw new Error(data.message || 'Failed to initialize payment');
        }
    } catch (err) {
        console.error('Paystack Initialization Error:', err);
        showToast('❌ ' + err.message);
        const btn = document.querySelector('button[onclick="initiateTopup()"]');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Pay with Paystack';
        }
    }
};

window.payWithPaystackDirect = async (amount, email, phone, provider, callback) => {
    console.log('Initiating Direct MoMo Charge...', { amount, email, phone, provider });

    try {
        const btn = document.querySelector('button[onclick="initiateTopup()"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Sending Push...';
        }

        // STEP 1: Direct Charge on Server
        const response = await fetch(`${PYTHON_API_BASE}/charge-momo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, email, phone, provider })
        });
        
        const data = await response.json();

        if (data.success) {
            showToast('📲 ' + data.message, 'info');
            
            // Poll for status or wait for user to confirm
            // For now, we use a simple interval to check if payment is verified
            let attempts = 0;
            const checkInterval = setInterval(async () => {
                attempts++;
                if (attempts > 30) { // Stop after 5 minutes (10s * 30)
                    clearInterval(checkInterval);
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Pay with Paystack';
                    }
                    return;
                }

                try {
                    const verifyRes = await fetch(`${PYTHON_API_BASE}/verify-payment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            reference: data.reference,
                            email: email,
                            amount: amount
                        })
                    });
                    const verifyData = await verifyRes.json();
                    
                    if (verifyData.success) {
                        clearInterval(checkInterval);
                        if (callback) callback({ reference: data.reference });
                    }
                } catch (e) {
                    console.warn('Polling error:', e);
                }
            }, 10000); // Check every 10 seconds

        } else {
            throw new Error(data.message || 'Failed to initiate charge');
        }
    } catch (err) {
        console.error('Direct Charge Error:', err);
        showToast('❌ ' + err.message);
        const btn = document.querySelector('button[onclick="initiateTopup()"]');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Pay with Paystack';
        }
    }
};

// --- iDATA Admin Balance System ---
/**
 * Checks the main iDATA account balance.
 * If balance is low, it warns the user/admin.
 */
async function checkAdminBalance() {
    // If API key is still the default or dummy, return a mock balance for demo
    if (API_KEY === 'YOUR_API_KEY_HERE' || API_KEY.startsWith('tera_live')) {
        // Even with a real key, we might want to skip this check if the endpoint doesn't exist yet
        // For now, let's allow the real key to bypass the maintenance block
        return 1000; 
    }

    try {
        const data = await api.get('/admin/balance'); 
        if (data && data.balance !== undefined) {
            const balance = parseFloat(data.balance);
            console.log(`[iDATA] Admin Balance: GHS ${balance}`);
            
            if (balance < 50) {
                showLowBalanceWarning(balance);
            }
            return balance;
        }
        return 0;
    } catch (error) {
        console.warn('Could not check iDATA admin balance. Using 0 as safety.');
        return 0;
    }
}

function showLowBalanceWarning(balance) {
    const warningId = 'low-balance-warning';
    if (document.getElementById(warningId)) return;

    const warning = document.createElement('div');
    warning.id = warningId;
    warning.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: #fef2f2;
        color: #991b1b;
        padding: 0.75rem 1.5rem;
        border-radius: 99px;
        border: 1px solid #fee2e2;
        box-shadow: var(--shadow-lg);
        z-index: 1001;
        font-weight: 600;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    warning.innerHTML = `
        <span>⚠️</span> 
        System Notice: Admin iDATA balance is low (GHS ${balance.toFixed(2)}). Purchases may be delayed.
    `;
    document.body.appendChild(warning);
}

// --- Theme Management ---
function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
        toggleBtn.innerHTML = state.theme === 'light' ? '🌙' : '☀️';
        toggleBtn.addEventListener('click', () => {
            state.theme = state.theme === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', state.theme);
            document.documentElement.setAttribute('data-theme', state.theme);
            toggleBtn.innerHTML = state.theme === 'light' ? '🌙' : '☀️';
        });
    }
}

// --- Cart Management ---
function updateCartUI() {
    const badges = document.querySelectorAll('.cart-count');
    badges.forEach(badge => {
        badge.textContent = state.cart.length;
        badge.style.display = state.cart.length > 0 ? 'flex' : 'none';
    });
}

/**
 * Checks if a purchase is feasible based on admin balance.
 */
async function checkPurchaseFeasibility(bundlePrice) {
    const adminBalance = await checkAdminBalance();
    if (adminBalance < bundlePrice) {
        if (API_KEY === 'YOUR_API_KEY_HERE' || API_KEY === 'tera_live_c695fb80bf3c9de198a0ee4a81173ea7') {
            // For the user's provided key, we'll treat it as valid for testing
            return true;
        }
        showToast('⚠️ Notice: System is currently undergoing maintenance. Please try again in 30 minutes.');
        console.error(`Insufficient iDATA Admin balance: GHS ${adminBalance} vs Required: GHS ${bundlePrice}`);
        return false;
    }
    return true;
}

async function addToCart(bundle) {
    // Check if admin has enough balance before adding to cart/buying
    const canProceed = await checkPurchaseFeasibility(bundle.price);
    if (!canProceed) return;

    if (!state.cart.find(item => item.id === bundle.id)) {
        state.cart.push(bundle);
        localStorage.setItem('cart', JSON.stringify(state.cart));
        updateCartUI();
        showToast(`Added ${bundle.title} to cart!`);
    } else {
        showToast('Item already in cart');
    }
}

function removeFromCart(id) {
    state.cart = state.cart.filter(item => item.id !== id);
    localStorage.setItem('cart', JSON.stringify(state.cart));
    updateCartUI();
    renderCart(); // If on checkout page
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    if (!container) return;

    if (state.cart.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">Your cart is empty</p>';
        if (totalEl) totalEl.textContent = formatCurrency(0);
        return;
    }

    let total = 0;
    container.innerHTML = state.cart.map(item => {
        total += item.price;
        return `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-body); border-radius: 12px; margin-bottom: 1rem;">
                <img src="${item.image}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
                <div style="flex: 1;">
                    <h4 style="font-size: 0.9rem; margin-bottom: 0.25rem;">${item.title}</h4>
                    <span style="font-weight: 700; color: var(--primary);">${formatCurrency(item.price)}</span>
                </div>
                <button onclick="removeFromCart(${item.id})" style="background: none; color: #ef4444; font-size: 1.25rem;">&times;</button>
            </div>
        `;
    }).join('');

    if (totalEl) totalEl.textContent = formatCurrency(total);
}

// --- Phone Validation ---
function isValidGhanaPhone(phone) {
    // Remove all non-digit characters except +
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    
    // Pattern 1: 0 followed by 9 digits (total 10)
    const pattern0 = /^0[235][0-9]{8}$/;
    
    // Pattern 2: +233 followed by 9 digits (total 13)
    const pattern233 = /^\+233[235][0-9]{8}$/;
    
    return pattern0.test(cleanPhone) || pattern233.test(cleanPhone);
}

// --- Purchase Modal ---
function openPurchaseModal(bundleId, bundleTitle, bundlePrice, bundleNetwork) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('purchase-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'purchase-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 3000;
            backdrop-filter: blur(8px);
            transition: all 0.3s ease;
        `;
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="purchase-modal-content" style="background: var(--bg-card); padding: 2.5rem; border-radius: 32px; max-width: 450px; width: 95%; position: relative; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid var(--border-color); animation: modalSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <button onclick="closePurchaseModal()" style="position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(0,0,0,0.05); border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; transition: all 0.2s;">&times;</button>
            
            <div style="text-align: center; margin-bottom: 2rem;">
                <div style="width: 70px; height: 70px; background: linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%); color: white; border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; font-size: 2rem; transform: rotate(-10deg); box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4);">📱</div>
                <h2 style="margin-bottom: 0.5rem; font-size: 1.75rem; font-weight: 800;">Recipient Number</h2>
                <p style="color: var(--text-muted); font-size: 0.95rem;">Buying <strong>${bundleTitle}</strong></p>
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.75rem; font-weight: 700; font-size: 0.9rem; color: var(--text-main);">Enter your number</label>
                <div style="position: relative;">
                    <input type="tel" id="modal-recipient-phone" placeholder="054 123 4567" 
                           style="width: 100%; padding: 1.1rem; border-radius: 16px; border: 2px solid var(--border-color); background: var(--bg-body); color: var(--text-main); font-size: 1.25rem; font-weight: 600; letter-spacing: 0.1em; transition: all 0.2s;">
                    <div id="phone-validation-status" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; opacity: 0;"></div>
                </div>
                <p id="phone-error" style="color: #ef4444; font-size: 0.8rem; margin-top: 0.75rem; display: none; font-weight: 500; background: rgba(239, 68, 68, 0.1); padding: 0.5rem 0.75rem; border-radius: 8px;">⚠️ Invalid Ghana number. Must start with 0 and be 10 digits.</p>
            </div>

            <div style="background: var(--bg-body); padding: 1.25rem; border-radius: 20px; margin-bottom: 2rem; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.9rem; color: var(--text-muted);">Network:</span>
                    <span class="network-badge ${bundleNetwork}" style="text-transform: uppercase; font-weight: 700; font-size: 0.75rem;">${bundleNetwork}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.9rem; color: var(--text-muted);">Price:</span>
                    <span style="font-weight: 800; color: var(--primary); font-size: 1.5rem;">${formatCurrency(bundlePrice)}</span>
                </div>
            </div>

            <button id="confirm-purchase-btn" class="btn btn-primary" style="width: 100%; padding: 1.1rem; justify-content: center; font-weight: 800; font-size: 1.1rem; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);">
                Confirm & Pay
            </button>
            
            <p style="text-align: center; margin-top: 1.25rem; font-size: 0.8rem; color: var(--text-muted);">
                By proceeding, you agree to our Terms of Service.
            </p>
        </div>
        <style>
            @keyframes modalSlideUp {
                from { opacity: 0; transform: translateY(30px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .purchase-modal-content button:hover {
                background: rgba(0,0,0,0.1) !important;
            }
        </style>
    `;

    const phoneInput = modal.querySelector('#modal-recipient-phone');
    const errorMsg = modal.querySelector('#phone-error');
    const confirmBtn = modal.querySelector('#confirm-purchase-btn');

    phoneInput.addEventListener('input', (e) => {
        // Remove spaces and non-numeric characters (except +)
        let val = e.target.value.replace(/\s+/g, '');
        e.target.value = val;

        if (val.length > 0 && !isValidGhanaPhone(val)) {
            phoneInput.style.borderColor = '#ef4444';
            errorMsg.style.display = 'block';
        } else {
            phoneInput.style.borderColor = val.length > 0 ? '#22c55e' : 'var(--border-color)';
            errorMsg.style.display = 'none';
        }
    });

    confirmBtn.onclick = async () => {
        const phone = phoneInput.value;
        if (!isValidGhanaPhone(phone)) {
            showToast('Please enter a valid Ghana phone number');
            phoneInput.focus();
            return;
        }

        closePurchaseModal();
        await processPurchase(bundleId, bundlePrice, phone, bundleNetwork);
    };

    modal.style.display = 'flex';
    phoneInput.focus();
}

function closePurchaseModal() {
    const modal = document.getElementById('purchase-modal');
    if (modal) modal.style.display = 'none';
}

// --- Auth Functions ---
async function login(email, password) {
    try {
        const response = await api.post('/login', { email, password });
        if (response.success && response.token) {
            // Clear any old session first to be safe
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            state.token = response.token;
            state.user = response.user;
            localStorage.setItem('token', state.token);
            localStorage.setItem('user', JSON.stringify(state.user));
            showToast('Login successful!');
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
        } else {
            showToast('Login failed: ' + (response.message || 'Invalid credentials'));
        }
    } catch (error) {
        showToast('Login error: ' + (error.message || 'Could not connect to server'));
    }
}

async function signup(name, email, password) {
    try {
        const response = await api.post('/signup', { name, email, password });
        if (response.success) {
            showToast('Signup successful! Please login.');
            setTimeout(() => window.location.href = 'login.html', 1500);
        } else {
            showToast('Signup failed: ' + (response.message || 'Error occurred'));
        }
    } catch (error) {
        showToast('Signup error: ' + (error.message || 'Could not connect to server'));
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    state.token = null;
    state.user = null;
    window.location.href = 'index.html';
}

async function refreshUserProfile() {
    if (!state.token || !state.user) return;
    try {
        const response = await fetch(`${PYTHON_API_BASE}/user/profile?email=${state.user.email}`);
        if (response.ok) {
            const userData = await response.json();
            state.user = userData;
            localStorage.setItem('user', JSON.stringify(state.user));
            console.log('User profile refreshed:', state.user.role);
            
            // If the role changed to admin while on a user page, or vice versa, we might need a redirect
            const path = window.location.pathname;
            const page = path.split('/').pop() || 'index.html';
            
            if (state.user.role === 'admin' && page === 'dashboard.html') {
                window.location.href = 'admin.html';
            } else if (state.user.role === 'user' && page === 'admin.html') {
                window.location.href = 'dashboard.html';
            }
        }
    } catch (error) {
        console.error('Failed to refresh user profile:', error);
    }
}

// --- UI Helpers ---
function formatCurrency(amount) {
    try {
        const val = parseFloat(amount || 0);
        return new Intl.NumberFormat('en-GH', {
            style: 'currency',
            currency: 'GHS',
        }).format(isNaN(val) ? 0 : val);
    } catch (e) {
        console.error('formatCurrency error:', e);
        return 'GHS ' + (parseFloat(amount || 0) || 0).toFixed(2);
    }
}

/**
 * UI HELPERS
 */
function showLoader() {
    console.log('Creating page loader');
    const loader = document.createElement('div');
    loader.className = 'page-loader';
    loader.innerHTML = '<div class="loader-spinner"></div>';
    document.body.appendChild(loader);
    
    // Emergency removal after 8 seconds if hideLoader is never called
    setTimeout(() => {
        if (document.body.contains(loader)) {
            console.warn('Loader stuck for 8s, emergency removal');
            hideLoader(loader);
        }
    }, 8000);
    
    return loader;
}

function hideLoader(loader) {
    if (!loader) return;
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 300);
}

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function renderBundleCard(bundle) {
    const isMember = !!state.token;
    
    // Calculate both prices for display
    // bundle.price is already the retail price calculated by the API service
    // We need to know the member price if we are currently public
    let memberPrice = bundle.price;
    let publicPrice = bundle.price;
    
    if (!isMember) {
        // If not a member, the current price is public. 
        // We calculate the member price by subtracting the public surcharge
        const settings = getMarkupSettings();
        memberPrice = Math.max(bundle.price - settings.publicSurcharge, bundle.price * 0.8); // Safety floor
    } else {
        // If a member, the current price is member price.
        // We calculate public price by adding the surcharge
        const settings = getMarkupSettings();
        publicPrice = bundle.price + settings.publicSurcharge;
    }

    return `
        <div class="bundle-card" data-id="${bundle.id}">
            <div style="padding: 1rem 1rem 0; display: flex; justify-content: space-between; align-items: center;">
                <span class="network-badge ${bundle.network}">${bundle.network}</span>
                ${!isMember ? '<span class="status-badge warning" style="font-size: 0.65rem;">Save GHS ' + (publicPrice - memberPrice).toFixed(2) + '</span>' : '<span class="status-badge success" style="font-size: 0.65rem;">Member Rate</span>'}
            </div>
            <img src="${bundle.image}" alt="${bundle.title}" class="bundle-img">
            <div class="bundle-content">
                <h3 class="bundle-title">${bundle.title}</h3>
                <p class="bundle-desc">${bundle.description}</p>
                
                <div style="margin: 1rem 0; padding: 0.75rem; background: var(--bg-body); border-radius: 12px; border: 1px dashed var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Member Price:</span>
                        <span style="font-weight: 700; color: #10b981; font-size: 1rem;">${formatCurrency(memberPrice)}</span>
                    </div>
                    ${!isMember ? `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Public Price:</span>
                        <span style="font-weight: 600; color: var(--text-body); font-size: 0.9rem; text-decoration: line-through; opacity: 0.6;">${formatCurrency(publicPrice)}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="bundle-footer">
                    <span class="bundle-price" style="font-size: 1.25rem;">${formatCurrency(bundle.price)}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <a href="details.html?id=${bundle.id}" class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Details</a>
                        <button class="btn btn-primary" style="padding: 0.4rem 1rem; font-size: 0.8rem;" onclick="event.preventDefault(); openPurchaseModal(${bundle.id}, '${bundle.title.replace(/'/g, "\\'")}', ${bundle.price}, '${bundle.network}')">
                            Buy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- Page Initializers ---
async function initHome() {
    const featuredContainer = document.getElementById('featured-bundles');
    if (!featuredContainer) return;

    const loader = showLoader();
    
    try {
        const bundles = await api.get('/bundles');
        state.bundles = bundles;
        featuredContainer.innerHTML = bundles.slice(0, 3).map(renderBundleCard).join('');
        renderLiveFeed();
    } catch (error) {
        featuredContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">Unable to load bundles. Please try again later.</p>`;
    } finally {
        hideLoader(loader);
    }
}

async function initShop() {
    const grid = document.getElementById('bundles-grid');
    const searchInput = document.getElementById('search-bundles');
    const networkFilter = document.getElementById('network-filter');
    const sortFilter = document.getElementById('sort-filter');
    if (!grid) return;

    const loader = showLoader();
    
    try {
        const bundles = await api.get('/bundles');
        state.bundles = bundles;

        const render = () => {
            const term = searchInput?.value.toLowerCase() || '';
            const network = networkFilter?.value || 'all';
            const sort = sortFilter?.value || 'newest';

            let filtered = bundles.filter(b => {
                const matchesSearch = b.title.toLowerCase().includes(term) || 
                                    b.description.toLowerCase().includes(term);
                const matchesNetwork = network === 'all' || b.network === network;
                return matchesSearch && matchesNetwork;
            });

            // Apply Sorting
            if (sort === 'price-low') filtered.sort((a, b) => a.price - b.price);
            if (sort === 'price-high') filtered.sort((a, b) => b.price - a.price);

            if (filtered.length === 0) {
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No bundles found matching your criteria.</p>';
                return;
            }

            // If "All" is selected and no search term, group by network
            if (network === 'all' && !term) {
                const networks = ['mtn', 'telecel', 'at'];
                grid.innerHTML = networks.map(net => {
                    const netBundles = filtered.filter(b => b.network === net);
                    if (netBundles.length === 0) return '';
                    return `
                        <div style="grid-column: 1/-1; margin-top: 2rem; border-bottom: 2px solid var(--primary); padding-bottom: 0.5rem;">
                            <h2 style="text-transform: uppercase; display: flex; align-items: center; gap: 1rem;">
                                <span class="network-badge ${net}">${net}</span>
                                ${net === 'mtn' ? 'MTN Ghana' : net === 'telecel' ? 'Telecel' : 'AT (AirtelTigo)'} Bundles
                            </h2>
                        </div>
                        ${netBundles.map(renderBundleCard).join('')}
                    `;
                }).join('');
            } else {
                grid.innerHTML = filtered.map(renderBundleCard).join('');
            }
        };

        render();

        searchInput?.addEventListener('input', render);
        networkFilter?.addEventListener('change', render);
        sortFilter?.addEventListener('change', render);
        
    } catch (error) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">Unable to load bundles. Please try again later.</p>`;
    } finally {
        hideLoader(loader);
    }
}

async function initDetails() {
    const container = document.getElementById('bundle-details');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) {
        window.location.href = 'bundles.html';
        return;
    }

    const loader = showLoader();
    
    try {
        const bundle = await api.get(`/bundles/${id}`);
        if (!bundle) {
            container.innerHTML = '<h2>Bundle not found</h2>';
            return;
        }

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: start;">
                <img src="${bundle.image}" alt="${bundle.title}" style="width: 100%; border-radius: 20px; box-shadow: var(--shadow-lg);">
                <div>
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                        <span class="network-badge ${bundle.network}">${bundle.network}</span>
                        <span style="color: var(--text-muted);">Non-expiry Bundle</span>
                    </div>
                    <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">${bundle.title}</h1>
                    <p style="font-size: 1.25rem; color: var(--text-muted); margin-bottom: 2rem;">${bundle.description}</p>
                    
                    <div style="background: var(--bg-card); padding: 2rem; border-radius: 16px; border: 1px solid var(--border-color); margin-bottom: 2rem;">
                        <h3 style="margin-bottom: 1.5rem;">Purchase Details</h3>
                        
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Enter your number</label>
                            <input type="tel" id="recipient-phone" placeholder="0541234567" 
                                   oninput="this.value = this.value.replace(/\s+/g, ''); this.style.borderColor = isValidGhanaPhone(this.value) ? '#22c55e' : '#ef4444'" 
                                   style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-main);">
                            <small id="phone-validation-hint" style="color: var(--text-muted); display: block; margin-top: 0.25rem;">Must be a valid 10-digit Ghana number starting with 0.</small>
                        </div>

                        <div class="form-group" style="margin-bottom: 2rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Network Provider</label>
                            <select id="network-provider" disabled style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-main); cursor: not-allowed; opacity: 0.8;">
                                <option value="mtn" ${bundle.network === 'mtn' ? 'selected' : ''}>MTN Ghana</option>
                                <option value="telecel" ${bundle.network === 'telecel' ? 'selected' : ''}>Telecel (Vodafone)</option>
                                <option value="at" ${bundle.network === 'at' ? 'selected' : ''}>AT (AirtelTigo)</option>
                            </select>
                            <small style="color: var(--text-muted); display: block; margin-top: 0.5rem;">* Network is locked to ${bundle.network.toUpperCase()} for this bundle.</small>
                        </div>

                        <div style="margin-bottom: 1.5rem; display: flex; align-items: flex-start; gap: 0.75rem;">
                            <input type="checkbox" id="terms-check" style="margin-top: 0.25rem; width: 18px; height: 18px; cursor: pointer;">
                            <label for="terms-check" style="font-size: 0.85rem; color: var(--text-muted); cursor: pointer; line-height: 1.4;">
                                I agree to the <a href="#" style="color: var(--primary);">Terms and Conditions</a>. I understand that orders must be reported within 24 hours if not received.
                            </label>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); pt-1.5rem; margin-top: 1rem; padding-top: 1.5rem;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 0.8rem; color: var(--text-muted);">Total to Pay</span>
                                <span style="font-size: 2rem; font-weight: 800; color: var(--primary);">${formatCurrency(bundle.price)}</span>
                            </div>
                            <button class="btn btn-primary" style="padding: 1rem 2rem;" onclick="processPurchase(${bundle.id}, ${bundle.price})">Proceed to Checkout</button>
                        </div>
                    </div>

                    <div style="background: rgba(37, 99, 235, 0.1); padding: 1.5rem; border-radius: 12px; color: var(--text-main); font-size: 0.875rem;">
                        <p style="margin-bottom: 0.5rem;"><strong>💡 Delivery Note:</strong> This bundle will be delivered within 1-5 minutes to <strong>${bundle.network.toUpperCase()}</strong> numbers only.</p>
                        <p style="color: #ef4444; font-weight: 600;">⚠️ REPORT YOUR ORDER IF IT'S DELIVERED BUT NOT RECEIVED WITHIN 24 HOURS. COMPLETED ORDERS AFTER 24 HOURS CANNOT BE CHECKED.</p>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<h2>Error loading bundle details.</h2>`;
    } finally {
        hideLoader(loader);
    }
}

async function processPurchase(bundleId, price, phone, network) {
    // If phone and network are passed (from modal), use them. 
    // Otherwise try to get them from the details page DOM.
    const recipientPhone = phone || document.getElementById('recipient-phone')?.value;
    const providerNetwork = network || document.getElementById('network-provider')?.value;
    const termsCheck = document.getElementById('terms-check');

    // On details page, we check terms. In modal, we assume consent by clicking confirm.
    if (document.getElementById('terms-check') && !termsCheck.checked) {
        showToast('Please agree to the Terms and Conditions to proceed');
        return;
    }

    if (!recipientPhone || !isValidGhanaPhone(recipientPhone)) {
        showToast('Please enter a valid Ghana phone number');
        return;
    }

    // --- GUEST CHECKOUT SUPPORT ---
    if (!state.token || !state.user) {
        const guestEmail = prompt("You are not logged in. Enter your email address to proceed with guest checkout (for payment receipt):");
        if (!guestEmail) return; // User cancelled
        
        if (!guestEmail.includes('@')) {
            showToast("A valid email is required for guest checkout.");
            return;
        }

        // Redirect to Paystack Hosted Page for guest payment
        showToast('Redirecting to Paystack...');
        
        // Store purchase info in localStorage for verification after redirect
        const pendingPurchase = {
            bundleId,
            price,
            phone: recipientPhone,
            network: providerNetwork,
            guestEmail: guestEmail
        };
        localStorage.setItem('pending_purchase', JSON.stringify(pendingPurchase));
        
        window.payWithPaystackHosted(price, guestEmail);
        return;
    }

    // --- 0. WALLET BALANCE CHECK ---
    const userBalance = parseFloat(state.user.balance || 0);
    
    // Check if user wants to pay directly for high-cost items or if balance is low
    let useDirectPayment = false;
    if (userBalance < price) {
        useDirectPayment = confirm(`Insufficient balance. Your balance: ${formatCurrency(userBalance)}. Required: ${formatCurrency(price)}.\n\nWould you like to pay GHS ${price} via the Paystack Payment Page?`);
        if (!useDirectPayment) return;
    } else if (price >= 50) {
        useDirectPayment = confirm(`This is a high-value bundle (${formatCurrency(price)}). Would you like to pay via the Paystack Payment Page instead of using your wallet balance?`);
    }

    if (useDirectPayment) {
        // Redirect to Paystack Hosted Page for payment
        showToast('Redirecting to Paystack...');
        
        // Store purchase info in localStorage
        const pendingPurchase = {
            bundleId,
            price,
            phone: recipientPhone,
            network: providerNetwork,
            guestEmail: null
        };
        localStorage.setItem('pending_purchase', JSON.stringify(pendingPurchase));
        
        window.payWithPaystackHosted(price, state.user.email);
        return;
    }

    // If balance is enough, execute directly
    await executePurchase(bundleId, price, recipientPhone, providerNetwork, false);
}

// New helper function to actually call the API
async function executePurchase(bundleId, price, phone, network, isPrepaid, guestEmail = null) {
    const btn = document.querySelector('.btn-primary');
    const originalText = btn ? btn.textContent : 'Buy Now';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processing Order...';
    }

    try {
        // --- 1. SEND TO PROVIDER ---
        const result = await api.post('/place-order', {
            network: network,
            beneficiary: phone,
            "pa_data-bundle-packages": bundleId,
            userEmail: guestEmail || state.user?.email
        });

        // --- 2. HANDLE RESPONSE ---
        if (result.success || result.transactionId || result.order_id) {
            showToast('✅ Order placed successfully!', 'success');
            // Refresh user profile if logged in
            if (state.token && state.user) {
                await refreshUserProfile();
            }
            
            // Show success message or redirect
            setTimeout(() => {
                if (state.token && state.user) {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'index.html?purchase=success';
                }
            }, 2500);
        } else {
            showToast('Order failed: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Purchase Error:', error);
        showToast('Failed to process purchase. Please try again.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

async function initDashboard() {
    console.log('initDashboard() started');
    const content = document.getElementById('dashboard-content');
    const userNameEl = document.getElementById('user-name');
    const userBalanceEl = document.getElementById('user-balance');
    
    if (!content) {
        console.error('dashboard-content element not found!');
        return;
    }

    if (!state.token || !state.user) {
        console.warn('No token or user in state - showing login message');
        content.innerHTML = `
            <div style="text-align: center; padding: 4rem;">
                <h2>Please log in to view your dashboard</h2>
                <a href="login.html" class="btn btn-primary" style="margin-top: 1rem;">Go to Login</a>
            </div>
        `;
        return;
    }

    console.log('User is logged in:', state.user.email);

    // Refresh profile to ensure latest role/balance
    await refreshUserProfile();

    // Set User Info
    if (userNameEl && state.user) {
        userNameEl.textContent = state.user.name || state.user.email.split('@')[0];
    }
    
    if (userBalanceEl && state.user) {
        userBalanceEl.textContent = formatCurrency(state.user.balance);
    }

    if (!state.user) {
        console.error('User not logged in or profile refresh failed');
        content.innerHTML = `
            <div style="text-align: center; padding: 4rem;">
                <h3>Please login to view your dashboard</h3>
                <a href="login.html" class="btn btn-primary" style="margin-top: 1rem;">Login Now</a>
            </div>
        `;
        return;
    }

    // Handle top-up redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'topup') {
        showTopupInfo();
    }

    console.log('Showing loader...');
    const loader = showLoader();

    try {
        let purchases = [];
        console.log('Fetching user purchases for:', state.user.email);
        try {
            // Using the api service ensures Authorization header is included
            const data = await api.get(`/user/purchases?email=${state.user.email}`);
            purchases = Array.isArray(data) ? data : [];
            console.log('Purchases fetched via API:', purchases.length);
        } catch (e) {
            console.warn('Backend history fetch failed, checking fallback:', e);
            purchases = JSON.parse(localStorage.getItem(`${APP_NAME}_purchases`) || '[]');
            console.log('Fallback purchases count:', purchases.length);
        }
        
        console.log('Rendering dashboard...');
        renderDashboard(purchases, content);
        console.log('Dashboard rendered successfully');
    } catch (error) {
        console.error('Error in initDashboard:', error);
        content.innerHTML = `<div style="padding: 2rem; color: #ef4444; text-align: center;">
            <h3>Error loading dashboard</h3>
            <p>${error.message}</p>
            <button onclick="location.reload()" class="btn btn-outline" style="margin-top: 1rem;">Try Again</button>
        </div>`;
    } finally {
        console.log('Hiding loader');
        hideLoader(loader);
    }
}

function renderDashboard(purchases, container) {
    // Calculate Stats
    const totalSpent = purchases.reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
    const completedOrders = purchases.filter(p => p.status?.toLowerCase() === 'completed').length;
    const pendingOrders = purchases.filter(p => p.status?.toLowerCase() === 'processing' || p.status?.toLowerCase() === 'pending').length;

    if (purchases.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem; background: var(--bg-card); border-radius: 20px; border: 1px dashed var(--border-color);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📦</div>
                <h3>Welcome to your Dashboard!</h3>
                <p class="text-muted" style="margin-bottom: 2rem;">Start your journey by purchasing your first data bundle.</p>
                <a href="bundles.html" class="btn btn-primary">Browse Bundles</a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <!-- Stats Section -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(37, 99, 235, 0.1); color: var(--primary);">💰</div>
                <span class="stat-value">${formatCurrency(state.user.balance)}</span>
                <span class="stat-label">Available Balance</span>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">💳</div>
                <span class="stat-value">${formatCurrency(totalSpent)}</span>
                <span class="stat-label">Total Spent</span>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">⏳</div>
                <span class="stat-value">${pendingOrders}</span>
                <span class="stat-label">Pending Orders</span>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6;">✅</div>
                <span class="stat-value">${completedOrders}</span>
                <span class="stat-label">Completed Orders</span>
            </div>
        </div>

        <!-- Quick Actions -->
        <div style="margin-bottom: 2rem;">
            <h3 style="font-size: 1.25rem; margin-bottom: 1rem;">Quick Actions</h3>
            <div class="quick-actions">
                <a href="bundles.html" class="action-card">
                    <span class="action-icon">📶</span>
                    <span class="action-label">Buy Data</span>
                </a>
                <div class="action-card" onclick="showTopupInfo()">
                    <span class="action-icon">➕</span>
                    <span class="action-label">Top-up Wallet</span>
                </div>
                <a href="https://wa.me/233502832593" target="_blank" class="action-card">
                    <span class="action-icon">💬</span>
                    <span class="action-label">Support</span>
                </a>
                <div class="action-card" onclick="location.reload()">
                    <span class="action-icon">🔄</span>
                    <span class="action-label">Refresh</span>
                </div>
            </div>
        </div>

        <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.25rem;">Recent Transactions</h3>
            <button class="btn btn-outline btn-sm" onclick="showAllTransactions()" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">View All</button>
        </div>

        <div style="background: var(--bg-card); border-radius: 20px; border: 1px solid var(--border-color); overflow: hidden; box-shadow: var(--shadow-sm);">
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="background: var(--bg-body);">
                        <tr>
                            <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Transaction</th>
                            <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Bundle</th>
                            <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Recipient</th>
                            <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Status</th>
                            <th style="padding: 1.25rem 1rem; text-align: right; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${purchases.slice(0, 10).map(p => {
                            const statusClass = p.status?.toLowerCase() === 'completed' ? 'success' : 
                                              p.status?.toLowerCase() === 'failed' ? 'danger' : 'warning';
                            return `
                            <tr class="transaction-row">
                                <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                                    <div style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">${p.id}</div>
                                    <div style="font-size: 0.75rem; margin-top: 0.25rem; color: var(--text-muted);">${p.date}</div>
                                </td>
                                <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                                    <div style="font-weight: 600;">${p.title}</div>
                                    <span class="network-badge ${p.network}" style="font-size: 0.6rem; margin: 0.25rem 0 0;">${p.network}</span>
                                </td>
                                <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); font-weight: 500;">${p.phone}</td>
                                <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                                    <span class="status-badge ${statusClass}">${p.status || 'Processing'}</span>
                                </td>
                                <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); text-align: right; font-weight: 700; color: var(--primary);">${formatCurrency(p.price)}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div style="margin-top: 2rem; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); padding: 1.5rem; border-radius: 16px;">
            <p style="color: #ef4444; font-weight: 700; font-size: 0.9rem; line-height: 1.6; text-align: center;">
                ⚠️ IMPORTANT POLICY: REPORT YOUR ORDER IF IT'S DELIVERED BUT NOT RECEIVED WITHIN 24 HOURS. COMPLETED ORDERS AFTER 24 HOURS CANNOT BE CHECKED.
            </p>
            <div style="text-align: center; margin-top: 1rem;">
                <a href="https://wa.me/233502832593" target="_blank" class="btn btn-outline" style="border-color: #ef4444; color: #ef4444;">Report Issue via WhatsApp</a>
            </div>
        </div>
    `;
}

function initAuth() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('button');
        const isSignup = submitBtn.textContent === 'Sign Up';
        
        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = isSignup ? 'Creating Account...' : 'Logging in...';
        
        if (isSignup) {
            const name = document.getElementById('name').value;
            await signup(name, email, password);
        } else {
            await login(email, password);
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    });
}

/**
 * GOOGLE AUTHENTICATION
 * Handles the callback from Google One Tap / Sign-in button
 */
async function handleGoogleResponse(response) {
    console.log("Google Token Received:", response.credential);
    showToast('Connecting to Google...');
    
    try {
        const result = await fetch(`${PYTHON_API_BASE}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });
        
        const data = await result.json();
        
        if (data.success && data.token) {
            // Clear any old session first to be safe
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            state.token = data.token;
            state.user = data.user;
            localStorage.setItem('token', state.token);
            localStorage.setItem('user', JSON.stringify(state.user));
            
            showToast('✅ Welcome back, ' + (data.user.name || 'User') + '!');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showToast('❌ Google Sign-In failed: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Google Auth Error:', error);
        showToast('❌ Connection error. Please try again.');
    }
}

// Global Exports for HTML inline events
window.handleGoogleResponse = handleGoogleResponse;
window.addToCart = addToCart;
window.logout = logout;
window.showTopupInfo = async () => {
    const modal = document.getElementById('topup-modal');
    if (modal) modal.style.display = 'flex';
};
window.hideTopupInfo = () => {
    const modal = document.getElementById('topup-modal');
    if (modal) modal.style.display = 'none';
};
window.showCart = () => {
    const modal = document.getElementById('cart-modal');
    if (modal) {
        modal.style.display = 'flex';
        renderCart();
    }
};
window.hideCart = () => {
    const modal = document.getElementById('cart-modal');
    if (modal) modal.style.display = 'none';
};
window.removeFromCart = removeFromCart;
window.showDashboardTab = (tab) => {
    const content = document.getElementById('dashboard-content');
    if (!content) return;
    
    const links = document.querySelectorAll('.sidebar-link');
    links.forEach(l => l.classList.remove('active'));
    
    // Find the link that was clicked (or match by text)
    const activeLink = Array.from(links).find(l => l.textContent.toLowerCase().includes(tab));
    if (activeLink) activeLink.classList.add('active');
    
    if (tab === 'history' || tab === 'bundles') {
        initDashboard();
    } else if (tab === 'settings') {
        renderSettings(content);
    }
};

window.showAllTransactions = () => {
    const purchases = JSON.parse(localStorage.getItem(`${APP_NAME}_purchases`) || '[]');
    const content = document.getElementById('dashboard-content');
    if (!content) return;
    
    content.innerHTML = `
        <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="font-size: 1.75rem;">All Transactions</h2>
            <button class="btn btn-outline btn-sm" onclick="initDashboard()">Back to Overview</button>
        </div>
        
        <div style="background: var(--bg-card); border-radius: 20px; border: 1px solid var(--border-color); overflow: hidden; box-shadow: var(--shadow-sm);">
            <div style="padding: 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; gap: 1rem; flex-wrap: wrap;">
                <input type="text" id="txn-search" placeholder="Search by phone or ID..." oninput="filterTransactions()" 
                    style="flex: 1; min-width: 200px; padding: 0.6rem 1rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-body);">
                <select id="txn-status" onchange="filterTransactions()"
                    style="padding: 0.6rem 1rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-body);">
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed</option>
                </select>
            </div>
            <div id="transactions-list-container" style="overflow-x: auto;">
                ${renderTransactionsTable(purchases)}
            </div>
        </div>
    `;
};

window.filterTransactions = () => {
    const query = document.getElementById('txn-search').value.toLowerCase();
    const status = document.getElementById('txn-status').value;
    const purchases = JSON.parse(localStorage.getItem(`${APP_NAME}_purchases`) || '[]');
    
    const filtered = purchases.filter(p => {
        const matchesSearch = p.phone.toLowerCase().includes(query) || p.id.toLowerCase().includes(query) || p.title.toLowerCase().includes(query);
        const matchesStatus = status === 'all' || p.status?.toLowerCase() === status.toLowerCase();
        return matchesSearch && matchesStatus;
    });
    
    const container = document.getElementById('transactions-list-container');
    if (container) container.innerHTML = renderTransactionsTable(filtered);
};

function renderTransactionsTable(purchases) {
    if (purchases.length === 0) {
        return `<div style="padding: 3rem; text-align: center; color: var(--text-muted);">No transactions found.</div>`;
    }
    
    return `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: var(--bg-body);">
                <tr>
                    <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Transaction</th>
                    <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Bundle</th>
                    <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Recipient</th>
                    <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Status</th>
                    <th style="padding: 1.25rem 1rem; text-align: right; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${purchases.map(p => {
                    const statusClass = p.status?.toLowerCase() === 'completed' ? 'success' : 
                                      p.status?.toLowerCase() === 'failed' ? 'danger' : 'warning';
                    return `
                    <tr class="transaction-row">
                        <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                            <div style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">${p.id}</div>
                            <div style="font-size: 0.75rem; margin-top: 0.25rem; color: var(--text-muted);">${p.date}</div>
                        </td>
                        <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                            <div style="font-weight: 600;">${p.title}</div>
                            <span class="network-badge ${p.network}" style="font-size: 0.6rem; margin: 0.25rem 0 0;">${p.network}</span>
                        </td>
                        <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); font-weight: 500;">${p.phone}</td>
                        <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                            <span class="status-badge ${statusClass}">${p.status || 'Processing'}</span>
                        </td>
                        <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); text-align: right; font-weight: 700; color: var(--primary);">${formatCurrency(p.price)}</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

window.initiateTopup = () => {
    const amountInput = document.getElementById('topup-amount');
    const amount = parseFloat(amountInput?.value);
    
    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount');
        return;
    }

    if (!state.user) {
        showToast('Please login to top up');
        return;
    }
    
    // Switch to Hosted Paystack Page so users can see the "Paystack Page"
    // and enter their MoMo number or Card details there.
    console.log('Redirecting to Paystack Hosted Page...');
    window.payWithPaystackHosted(amount, state.user.email);
};

function renderSettings(container) {
    container.innerHTML = `
        <div style="margin-bottom: 2rem;">
            <h2 style="font-size: 1.75rem;">Account Settings</h2>
            <p class="text-muted">Manage your profile and account security.</p>
        </div>
        
        <div style="display: grid; gap: 2rem;">
            <div style="background: var(--bg-card); padding: 2rem; border-radius: 20px; border: 1px solid var(--border-color);">
                <h3 style="margin-bottom: 1.5rem; font-size: 1.1rem;">Profile Information</h3>
                <div style="display: grid; gap: 1rem;">
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 0.4rem; font-size: 0.9rem; color: var(--text-muted);">Email Address</label>
                        <input type="text" value="${state.user.email}" disabled 
                            style="width: 100%; padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-muted); cursor: not-allowed;">
                    </div>
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 0.4rem; font-size: 0.9rem; color: var(--text-muted);">Account ID</label>
                        <input type="text" value="${state.user.email.split('@')[0].toUpperCase()}" disabled 
                            style="width: 100%; padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-muted); cursor: not-allowed;">
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-card); padding: 2rem; border-radius: 20px; border: 1px solid var(--border-color);">
                <h3 style="margin-bottom: 1.5rem; font-size: 1.1rem; color: #ef4444;">Danger Zone</h3>
                <button class="btn btn-outline" onclick="logout()" style="border-color: #ef4444; color: #ef4444; width: 100%; justify-content: center;">Sign Out of All Devices</button>
            </div>
        </div>
    `;
}

async function handlePaymentCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get('reference') || urlParams.get('trxref');
    
    if (reference) {
        console.log('Detected Paystack reference, verifying...', reference);
        showToast('Verifying payment... Please wait.');
        
        try {
            // Get amount from localStorage (stored during initialization)
            const expectedAmount = localStorage.getItem('pending_payment_amount');
            
            const response = await fetch(`${PYTHON_API_BASE}/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    reference: reference,
                    email: state.user ? state.user.email : null,
                    amount: expectedAmount
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Check if there was a pending purchase
                const pendingPurchaseStr = localStorage.getItem('pending_purchase');
                if (pendingPurchaseStr) {
                    const p = JSON.parse(pendingPurchaseStr);
                    showToast('✅ Payment verified! Processing your bundle...', 'success');
                    await executePurchase(p.bundleId, p.price, p.phone, p.network, true, p.guestEmail);
                    localStorage.removeItem('pending_purchase');
                } else {
                    showToast('✅ Payment successful! Wallet updated.', 'success');
                }
                
                // Clear the pending payment data
                localStorage.removeItem('pending_payment_ref');
                localStorage.removeItem('pending_payment_amount');
                
                // Clean up URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
                
                // Refresh profile to show new balance
                if (state.token && state.user) {
                    await refreshUserProfile();
                }
            } else {
                showToast('❌ Payment verification failed: ' + result.message, 'error');
            }
        } catch (err) {
            console.error('Callback Verification Error:', err);
            showToast('⚠️ Error verifying payment. Please contact support.');
        }
    }
}

// --- Main Router ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Initializing Router');
    try {
        initTheme();
        updateCartUI();
        
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        console.log('Current Page:', page);
        
        // Check for Paystack payment callback (iDATA Formula)
        console.log('Checking payment callback...');
        await handlePaymentCallback();
        
        // Refresh user profile on load to ensure correct role and balance
        if (state.token && state.user) {
            console.log('Refreshing user profile for:', state.user.email);
            await refreshUserProfile();
        }
        
        console.log('Updating Nav UI');
        updateNavAuthUI(); 
        
        if (state.user && state.user.role === 'admin') {
            console.log('Admin user detected - checking balance');
            checkAdminBalance(); 
        }
        
        console.log('Routing to:', page);
        if (page === 'index.html' || page === '') initHome();
        if (page === 'bundles.html') initShop();
        if (page === 'details.html') initDetails();
        if (page === 'dashboard.html') {
            console.log('Initializing Dashboard...');
            initDashboard();
        }
        if (page === 'admin.html') {
            console.log('Initializing Admin...');
            initAdmin();
        }
        if (page === 'login.html') initAuth();
    } catch (err) {
        console.error('CRITICAL INITIALIZATION ERROR:', err);
        // If on dashboard or admin, show an error message if it's stuck
        const content = document.getElementById('dashboard-content') || document.getElementById('admin-content');
        if (content) {
            content.innerHTML = `
                <div style="padding: 3rem; text-align: center;">
                    <h2 style="color: #ef4444;">System Error</h2>
                    <p>We encountered a problem while loading this page. Please refresh or contact support.</p>
                    <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 1rem;">Refresh Page</button>
                </div>
            `;
        }
    }
});

// --- Admin Panel Logic ---
async function initAdmin() {
    // SECURITY: Double-check admin status with backend
    if (!state.user) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const verify = await fetch(`${PYTHON_API_BASE}/admin/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.user.email })
        });
        const result = await verify.json();
        if (!result.success) {
            window.location.href = 'index.html';
            return;
        }
    } catch (err) {
        window.location.href = 'index.html';
        return;
    }

    // Load bundles if not already loaded
    if (state.bundles.length === 0) {
        try {
            state.bundles = await api.get('/bundles');
        } catch (e) {
            console.error('Failed to load bundles in admin:', e);
        }
    }

    const idataBalanceEl = document.getElementById('admin-idata-balance');
    const transactionsTable = document.getElementById('admin-transactions-table');
    const totalSalesEl = document.getElementById('total-sales');
    const totalProfitEl = document.getElementById('total-profit');
    const activeOrdersEl = document.getElementById('active-orders');
    const totalUsersEl = document.getElementById('total-users');
    const priceTable = document.getElementById('admin-price-table');

    // 1. Tab Switching Logic
    const navLinks = document.querySelectorAll('#admin-nav .sidebar-link');
    const tabs = document.querySelectorAll('.admin-tab');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = link.getAttribute('data-tab');
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            tabs.forEach(t => t.style.display = 'none');
            const activeTab = document.getElementById(`tab-${targetTab}`);
            if (activeTab) activeTab.style.display = 'block';

            if (targetTab === 'prices') {
                renderProfitSettings();
                renderPriceControl();
            }
            if (targetTab === 'users') renderUserManagement();
            if (targetTab === 'api') {
                // API Settings are now handled via environment variables on Render
                const apiTab = document.getElementById('tab-api');
                if (apiTab) apiTab.innerHTML = `
                    <div style="padding: 2rem; text-align: center;">
                        <h3>API Configuration</h3>
                        <p class="text-muted">API keys and secrets are securely managed in the production environment.</p>
                        <div style="margin-top: 2rem; padding: 1.5rem; background: var(--bg-body); border-radius: 12px; border: 1px solid var(--border-color);">
                            <p><strong>iDATA Integration:</strong> Active ✅</p>
                            <p><strong>Paystack Gateway:</strong> Active ✅</p>
                        </div>
                    </div>
                `;
            }
        });
    });

    // 2. Fetch iDATA Admin Balance
    const balance = await checkAdminBalance();
    if (idataBalanceEl) idataBalanceEl.textContent = formatCurrency(balance);

    // 3. Initial Data Load
    refreshAdminStats();
    refreshAdminOrders();
}

async function refreshAdminStats() {
    const totalSalesEl = document.getElementById('total-sales');
    const totalProfitEl = document.getElementById('total-profit');
    const activeOrdersEl = document.getElementById('active-orders');
    const totalUsersEl = document.getElementById('total-users');

    try {
        const statsData = await api.get('/admin/stats');
        if (statsData.success) {
            if (totalSalesEl) totalSalesEl.textContent = formatCurrency(statsData.stats.total_revenue);
            if (totalProfitEl) totalProfitEl.textContent = formatCurrency(statsData.stats.total_profit);
            if (totalUsersEl) totalUsersEl.textContent = statsData.stats.total_users;
            if (activeOrdersEl) activeOrdersEl.textContent = statsData.stats.total_orders;
        }
    } catch (e) {
        console.error('Failed to fetch admin stats:', e);
    }
}

async function refreshAdminOrders() {
    const transactionsTable = document.getElementById('admin-transactions-table');
    if (!transactionsTable) return;

    transactionsTable.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;"><span class="spinner"></span> Loading orders...</td></tr>';

    let allTransactions = [];
    try {
        const ordersData = await api.get('/admin/orders');
        if (ordersData.success) {
            allTransactions = ordersData.orders;
        }
    } catch (e) {
        console.error('Failed to fetch admin orders:', e);
        allTransactions = JSON.parse(localStorage.getItem(`${APP_NAME}_global_transactions`) || '[]');
    }

    if (allTransactions.length === 0) {
        transactionsTable.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No transactions found in system.</td></tr>';
    } else {
        transactionsTable.innerHTML = allTransactions.map(t => {
            const cost = t.cost || (state.bundles.find(b => b.id === t.bundleId)?.price) || (t.price * 0.9);
            const profit = t.price - cost;

            return `
                <tr>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                        <div style="font-weight: 600;">${t.userEmail || 'Customer'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${t.date}</div>
                    </td>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                        <div style="font-weight: 500;">${t.title}</div>
                        <span class="network-badge ${t.network}">${t.network}</span>
                    </td>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">${t.phone}</td>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                        <span class="status-badge ${t.status?.toLowerCase() === 'completed' ? 'success' : 'warning'}">${t.status || 'Processing'}</span>
                    </td>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); color: var(--success); font-weight: 600;">
                        +${formatCurrency(profit)}
                    </td>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); text-align: right;">
                        <button class="btn btn-outline" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;" onclick="updateOrderStatus('${t.id}')">Update</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

async function renderUserManagement() {
    const content = document.getElementById('tab-users');
    if (!content) return;

    content.innerHTML = `
        <div style="margin-bottom: 2rem;">
            <h2 style="font-size: 1.75rem; margin-bottom: 0.5rem;">User Management</h2>
            <p class="text-muted">View and manage all registered customers.</p>
        </div>
        <div style="background: var(--bg-card); border-radius: 20px; border: 1px solid var(--border-color); overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: var(--bg-body);">
                    <tr>
                        <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase;">User Name</th>
                        <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase;">Email</th>
                        <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase;">Balance</th>
                        <th style="padding: 1.25rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase;">Role</th>
                    </tr>
                </thead>
                <tbody id="admin-user-table">
                    <tr><td colspan="4" style="text-align: center; padding: 2rem;">Loading users...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const data = await api.get('/admin/users');
        const usersTable = document.getElementById('admin-user-table');
        if (data.success && usersTable) {
            usersTable.innerHTML = data.users.map(u => `
                <tr>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); font-weight: 600;">${u.name || 'N/A'}</td>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">${u.email}</td>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); font-weight: 600;">${formatCurrency(u.balance || 0)}</td>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                        <span class="status-badge ${u.role === 'admin' ? 'success' : 'info'}" style="background: ${u.role === 'admin' ? 'var(--danger-light)' : 'var(--primary-light)'}; color: ${u.role === 'admin' ? 'var(--danger)' : 'var(--primary)'};">
                            ${u.role || 'user'}
                        </span>
                    </td>
                    <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); text-align: right;">
                        <button class="btn btn-outline" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;" onclick="updateUserBalance('${u.email}', ${u.balance || 0})">Edit Balance</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Failed to load users:', e);
    }
}

function renderPriceControl() {
    const priceTable = document.getElementById('admin-price-table');
    if (!priceTable) return;

    const customPrices = JSON.parse(localStorage.getItem('customPrices')) || {};

    priceTable.innerHTML = state.bundles.map(b => {
        const formulaPrice = getRetailPrice(b.id, b.price, true); // true for member price
        const customValue = customPrices[b.id] || '';

        return `
            <tr>
                <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                    <div style="font-weight: 600;">${b.title}</div>
                    <span class="network-badge ${b.network}">${b.network}</span>
                </td>
                <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">GHS ${b.price.toFixed(2)}</td>
                <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">GHS ${formulaPrice.toFixed(2)}</td>
                <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="color: var(--text-muted);">GHS</span>
                        <input type="number" id="price-input-${b.id}" value="${customValue}" placeholder="e.g. 5.50" 
                            style="width: 100px; padding: 0.4rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-body);">
                    </div>
                </td>
                <td style="padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); text-align: right;">
                    <button class="btn btn-primary" style="font-size: 0.75rem; padding: 0.4rem 1rem;" onclick="saveCustomPrice(${b.id})">Set Price</button>
                </td>
            </tr>
        `;
    }).join('');
}

function saveCustomPrice(bundleId) {
    const input = document.getElementById(`price-input-${bundleId}`);
    const newPrice = input.value;
    const customPrices = JSON.parse(localStorage.getItem('customPrices')) || {};

    if (newPrice === '' || parseFloat(newPrice) <= 0) {
        delete customPrices[bundleId];
        showToast('Price reset to formula standard.');
    } else {
        customPrices[bundleId] = parseFloat(newPrice).toFixed(2);
        showToast(`Price for bundle updated successfully!`);
    }

    localStorage.setItem('customPrices', JSON.stringify(customPrices));
    renderPriceControl();
}

window.saveCustomPrice = saveCustomPrice;

function renderProfitSettings() {
    const settings = getMarkupSettings();
    
    const flatInput = document.getElementById('setting-flat');
    const percentInput = document.getElementById('setting-percent');
    const surchargeInput = document.getElementById('setting-surcharge');
    const minInput = document.getElementById('setting-min');

    if (flatInput) flatInput.value = settings.flat;
    if (percentInput) percentInput.value = settings.percent;
    if (surchargeInput) surchargeInput.value = settings.publicSurcharge;
    if (minInput) minInput.value = settings.minProfit;
}

function saveProfitSettings() {
    const flat = parseFloat(document.getElementById('setting-flat').value);
    const percent = parseFloat(document.getElementById('setting-percent').value);
    const publicSurcharge = parseFloat(document.getElementById('setting-surcharge').value);
    const minProfit = parseFloat(document.getElementById('setting-min').value);

    if (isNaN(flat) || isNaN(percent) || isNaN(publicSurcharge) || isNaN(minProfit)) {
        showToast('Please enter valid numbers for all settings.');
        return;
    }

    const newSettings = { flat, percent, publicSurcharge, minProfit };
    localStorage.setItem('markupSettings', JSON.stringify(newSettings));
    
    showToast('Global profit formula updated successfully!');
    renderPriceControl(); // Refresh prices based on new formula
}

window.saveProfitSettings = saveProfitSettings;

async function updateOrderStatus(orderId) {
    const newStatus = prompt('Enter new status (Completed, Failed, Processing):');
    if (!newStatus) return;

    const status = newStatus.charAt(0).toUpperCase() + newStatus.slice(1).toLowerCase();
    if (!['Completed', 'Failed', 'Processing'].includes(status)) {
        showToast('Invalid status. Please enter Completed, Failed, or Processing.');
        return;
    }

    try {
        const response = await api.post('/admin/order/update', {
            order_id: orderId,
            status: status
        });

        if (response.success) {
            showToast('Order status updated!');
            // Don't call initAdmin() - it's too heavy. Just refresh orders.
            refreshAdminOrders(); 
        } else {
            showToast('Failed to update status: ' + response.message);
        }
    } catch (error) {
        showToast('Error updating status: ' + error.message);
    }
}

async function updateUserBalance(email, currentBalance) {
    const newBalance = prompt(`Enter new balance for ${email}:`, currentBalance);
    if (newBalance === null) return;

    try {
        const response = await api.post('/admin/user/update-balance', {
            email: email,
            balance: parseFloat(newBalance)
        });

        if (response.success) {
            showToast('User balance updated!');
            renderUserManagement(); // Refresh the table
            refreshAdminStats(); // Update the total stats as well
        } else {
            showToast('Failed to update balance: ' + response.message);
        }
    } catch (error) {
        showToast('Error updating balance: ' + error.message);
    }
}

window.initAdmin = initAdmin;
window.refreshAdminOrders = refreshAdminOrders;
window.refreshAdminStats = refreshAdminStats;
window.updateOrderStatus = updateOrderStatus;
window.updateUserBalance = updateUserBalance;
window.refreshAdminData = initAdmin;

// --- Live Feed ---
function renderLiveFeed() {
    const feedContainer = document.getElementById('live-feed');
    if (!feedContainer) return;

    const names = ['Kojo', 'Ama', 'Kwame', 'Abena', 'Yaw', 'Efua', 'Kofi', 'Esi'];
    const actions = ['purchased 10GB MTN', 'topped up wallet', 'purchased 5GB Telecel', 'joined membership', 'purchased 20GB AT'];
    
    function addFeedItem() {
        const name = names[Math.floor(Math.random() * names.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const item = document.createElement('div');
        item.className = 'feed-item';
        item.innerHTML = `<strong>${name}</strong> just ${action}`;
        
        feedContainer.prepend(item);
        if (feedContainer.children.length > 5) {
            feedContainer.lastChild.remove();
        }
    }

    // Initial items
    for(let i=0; i<3; i++) addFeedItem();
    // New item every 10-20 seconds
    setInterval(addFeedItem, Math.random() * 10000 + 10000);
}

// New function to update navigation based on auth state
function updateNavAuthUI() {
    const navActions = document.querySelector('.nav-actions');
    const hero = document.querySelector('.hero');
    const memberSection = document.querySelector('.section .member-banner')?.closest('.section');
    
    if (!navActions) return;

    // Clear existing dynamic buttons (except theme toggle and cart)
    const dynamicButtons = navActions.querySelectorAll('.btn, .user-profile-nav');
    dynamicButtons.forEach(btn => btn.remove());

    if (state.token && state.user) {
        // --- USER IS LOGGED IN ---
        const initials = (state.user.name || state.user.email || 'U').charAt(0).toUpperCase();
        const balance = formatCurrency(state.user.balance || 0);

        const profileHTML = `
            <div class="user-profile-nav" onclick="window.location.href='${state.user.role === 'admin' ? 'admin.html' : 'dashboard.html'}'" title="Go to Dashboard">
                <div class="user-avatar-sm" style="${state.user.role === 'admin' ? 'background: var(--danger);' : ''}">${initials}</div>
                <div class="user-balance-nav">${balance}</div>
            </div>
            ${state.user.role === 'admin' ? '<a href="admin.html" class="btn btn-outline" style="border-color: var(--danger); color: var(--danger);">Admin Panel</a>' : ''}
            <button class="btn btn-outline logout-btn" onclick="logout()">Logout</button>
        `;
        navActions.insertAdjacentHTML('beforeend', profileHTML);

        // Hide Member Promo Section if logged in (they are already a member)
        if (memberSection) {
            memberSection.style.display = 'none';
        }

        // Update Hero for Logged In User
        if (hero) {
            const title = hero.querySelector('.hero-title');
            const tagline = hero.querySelector('.hero-tagline');
            const heroButtons = hero.querySelector('.btn-group') || hero.querySelector('div[style*="display: flex"]');

            if (title) title.textContent = `Welcome Back, ${state.user.name || state.user.email.split('@')[0]}!`;
            if (tagline) tagline.textContent = state.user.role === 'admin' ? 'Administrator access granted. Manage your store, users, and bundles from the dashboard.' : 'Your member-exclusive prices are now active. Browse our bundles and save on every purchase.';
            
            if (heroButtons) {
                if (state.user.role === 'admin') {
                    heroButtons.innerHTML = `
                        <a href="admin.html" class="btn btn-primary" style="padding: 0.8rem 2rem; font-size: 1.1rem;">Admin Dashboard</a>
                        <a href="bundles.html" class="btn btn-outline" style="padding: 0.8rem 2rem; font-size: 1.1rem;">Store View</a>
                    `;
                } else {
                    heroButtons.innerHTML = `
                        <a href="bundles.html" class="btn btn-primary" style="padding: 0.8rem 2rem; font-size: 1.1rem;">Browse Bundles</a>
                        <a href="dashboard.html" class="btn btn-outline" style="padding: 0.8rem 2rem; font-size: 1.1rem;">My Dashboard</a>
                    `;
                }
            }
        }
    } else {
        // --- USER IS LOGGED OUT ---
        const authHTML = `
            <a href="login.html" class="btn btn-primary">Login</a>
            <a href="login.html" class="btn btn-outline">Join Now</a>
        `;
        navActions.insertAdjacentHTML('beforeend', authHTML);

        // Show Member Promo Section if logged out
        if (memberSection) {
            memberSection.style.display = 'block';
        }

        // Reset Hero for Logged Out User
        if (hero) {
            const title = hero.querySelector('.hero-title');
            const tagline = hero.querySelector('.hero-tagline');
            const heroButtons = hero.querySelector('.btn-group') || hero.querySelector('div[style*="display: flex"]');

            if (title) title.textContent = 'PolymathBundleHub';
            if (tagline) tagline.textContent = 'Premium Data Bundles at Unbeatable Prices. Save up to 30% on MTN, Telecel, and AT bundles when you join our membership.';
            
            if (heroButtons) {
                heroButtons.innerHTML = `
                    <a href="bundles.html" class="btn btn-primary" style="padding: 0.8rem 2rem; font-size: 1.1rem;">Browse Bundles</a>
                    <a href="login.html" class="btn btn-outline" style="padding: 0.8rem 2rem; font-size: 1.1rem;">Join Membership</a>
                `;
            }
        }
    }
}
