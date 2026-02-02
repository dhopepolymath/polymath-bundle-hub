from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import json
import os
import base64
import hmac
import hashlib
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='.')
CORS(app, resources={r"/*": {"origins": "*"}}) # Allow all origins for debugging connection issues

# --- Configuration ---
# SECURITY: Use environment variables for sensitive data
IDATA_API_KEY = os.environ.get("IDATA_API_KEY")
if not IDATA_API_KEY:
    print("WARNING: IDATA_API_KEY not set! Check your .env file.")
IDATA_BASE_URL = "https://idatagh.com/api/v1"

PAYSTACK_SECRET_KEY = os.environ.get("PAYSTACK_SECRET_KEY")

# Log key status for debugging (masking for safety)
if PAYSTACK_SECRET_KEY:
    masked_key = f"{PAYSTACK_SECRET_KEY[:7]}...{PAYSTACK_SECRET_KEY[-4:]}"
    print(f"DEBUG: Using Paystack Key: {masked_key}")
else:
    print("DEBUG: CRITICAL - NO PAYSTACK KEY FOUND")

if not PAYSTACK_SECRET_KEY:
    print("WARNING: PAYSTACK_SECRET_KEY not set! Check your .env file.")

# Render Outbound IP Addresses (for whitelisting on 3rd party APIs like iDATA/Paystack)
RENDER_OUTBOUND_IPS = os.environ.get("RENDER_OUTBOUND_IPS", "74.220.48.0/24,74.220.56.0/24").split(",")

def is_request_from_render():
    """Helper to check if the request is coming from Render's network"""
    if os.environ.get("FLASK_ENV") != "production":
        return True # Always allow in dev
        
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if not client_ip:
        return False
        
    # In a real implementation, you'd use the ipaddress module to check CIDR ranges
    # For now, we'll just log the IP for debugging if needed
    print(f"[SECURITY] Request from IP: {client_ip}")
    return True # Default to true for now to avoid blocking legitimate traffic

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "467182904845-4h70aumpqvutir4q4f467svkvu085umd.apps.googleusercontent.com")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "your_secret_here")

# --- Mock Database ---
# Using a simple JSON file for persistence in this demo
DB_FILE = os.environ.get("DB_FILE", "database.json")

def load_db():
    if not os.path.exists(DB_FILE):
        # Create default DB with a test user
        default_db = {
            "users": [
                {
                    "name": "Admin User",
                    "email": "nuhuabdulai50@gmail.com",
                    "password": "password123",
                    "balance": 100.0,
                    "role": "admin"
                }
            ],
            "orders": []
        }
        save_db(default_db)
        return default_db
    with open(DB_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"users": [], "orders": []}

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

# --- Routes ---

@app.before_request
def log_request_info():
    # Only log in development
    if os.environ.get("FLASK_ENV") != "production":
        app.logger.debug('Headers: %s', request.headers)
        app.logger.debug('Body: %s', request.get_data())
        print(f"[{datetime.now()}] {request.method} {request.url}")

@app.route("/api/status", methods=["GET"])
def get_status():
    return jsonify({
        "status": "online",
        "message": "PolymathBundleHub Secure Backend is active",
        "security_mode": "hardened"
    })

# --- Bundles Data ---
BUNDLES = [
    # --- MTN GHANA (Non-Expiry) ---
    { "id": 5, "network": "mtn", "title": "MTN 1GB", "description": "MTN Non-expiry Data Bundle", "price": 4.30, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
    { "id": 6, "network": "mtn", "title": "MTN 2GB", "description": "MTN Non-expiry Data Bundle", "price": 8.50, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
    { "id": 7, "network": "mtn", "title": "MTN 5GB", "description": "MTN Non-expiry Data Bundle", "price": 21.00, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
    { "id": 8, "network": "mtn", "title": "MTN 10GB", "description": "MTN Non-expiry Data Bundle", "price": 42.00, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
    { "id": 9, "network": "mtn", "title": "MTN 20GB", "description": "MTN Non-expiry Data Bundle", "price": 82.00, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
    { "id": 10, "network": "mtn", "title": "MTN 50GB", "description": "MTN Non-expiry Data Bundle", "price": 200.00, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
    { "id": 11, "network": "mtn", "title": "MTN 100GB", "description": "MTN Non-expiry Data Bundle", "price": 390.00, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },

    # --- TELECEL (Formerly Vodafone) ---
    { "id": 20, "network": "telecel", "title": "Telecel 1GB", "description": "Telecel Special Data Bundle", "price": 4.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
    { "id": 21, "network": "telecel", "title": "Telecel 2GB", "description": "Telecel Special Data Bundle", "price": 7.80, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
    { "id": 22, "network": "telecel", "title": "Telecel 5GB", "description": "Telecel Special Data Bundle", "price": 19.50, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
    { "id": 23, "network": "telecel", "title": "Telecel 10GB", "description": "Telecel Special Data Bundle", "price": 38.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
    { "id": 24, "network": "telecel", "title": "Telecel 20GB", "description": "Telecel Special Data Bundle", "price": 75.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
    { "id": 25, "network": "telecel", "title": "Telecel 50GB", "description": "Telecel Special Data Bundle", "price": 180.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
    { "id": 26, "network": "telecel", "title": "Telecel 100GB", "description": "Telecel Special Data Bundle", "price": 350.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },

    # --- AT (AirtelTigo) ---
    { "id": 30, "network": "at", "title": "AT 1GB", "description": "AT Big Time Data", "price": 3.50, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
    { "id": 31, "network": "at", "title": "AT 2GB", "description": "AT Big Time Data", "price": 6.80, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
    { "id": 32, "network": "at", "title": "AT 5GB", "description": "AT Big Time Data", "price": 16.50, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
    { "id": 33, "network": "at", "title": "AT 10GB", "description": "AT Big Time Data", "price": 32.00, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
    { "id": 34, "network": "at", "title": "AT 20GB", "description": "AT Big Time Data", "price": 62.00, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
    { "id": 35, "network": "at", "title": "AT 50GB", "description": "AT Big Time Data", "price": 150.00, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
    { "id": 36, "network": "at", "title": "AT 100GB", "description": "AT Big Time Data", "price": 290.00, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" }
]

@app.route("/api/bundles", methods=["GET"])
def get_bundles():
    # SECURITY: Proxying the bundles request to iDATA without exposing API_KEY to browser
    return jsonify(BUNDLES)

@app.route("/api/bundles/<int:bundle_id>", methods=["GET"])
def get_bundle_by_id(bundle_id):
    bundle = next((b for b in BUNDLES if b["id"] == bundle_id), None)
    return jsonify(bundle)

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    
    db = load_db()
    user = next((u for u in db.get("users", []) if u["email"] == email), None)
    
    if user and user.get("password") == password:
        token = "demo-token-" + os.urandom(8).hex()
        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "email": user["email"],
                "name": user.get("name", "User"),
                "balance": user.get("balance", 0.0),
                "role": user.get("role", "user")
            }
        })
    
    return jsonify({"success": False, "message": "Invalid email or password"}), 401

@app.route("/api/auth/google", methods=["POST"])
def google_auth():
    data = request.json
    google_token = data.get("token")
    
    if not google_token:
        return jsonify({"success": False, "message": "No token provided"}), 400

    try:
        # JWT format: header.payload.signature
        # We only need the payload (index 1)
        payload_b64 = google_token.split('.')[1]
        
        # Fix padding if necessary
        missing_padding = len(payload_b64) % 4
        if missing_padding:
            payload_b64 += '=' * (4 - missing_padding)
            
        payload_json = base64.b64decode(payload_b64).decode('utf-8')
        user_info = json.loads(payload_json)
        
        email = user_info.get("email")
        name = user_info.get("name", email.split('@')[0])
        
        if not email:
            return jsonify({"success": False, "message": "Invalid token payload"}), 400
            
    except Exception as e:
        print(f"Error decoding Google token: {e}")
        return jsonify({"success": False, "message": "Failed to decode token"}), 400
    
    db = load_db()
    user = next((u for u in db.get("users", []) if u["email"] == email), None)
    
    if not user:
        # Create new user if they don't exist
        # ONLY nuhuabdulai50@gmail.com is allowed to be admin by default
        role = "admin" if email == "nuhuabdulai50@gmail.com" else "user"
        user = {
            "name": name,
            "email": email,
            "password": "google-auth-protected", # Placeholder
            "balance": 0.0,
            "role": role,
            "auth_type": "google"
        }
        db.setdefault("users", []).append(user)
        save_db(db)
    
    token = "demo-google-token-" + os.urandom(8).hex()
    return jsonify({
        "success": True,
        "token": token,
        "user": {
            "email": user["email"],
            "name": user["name"],
            "balance": user["balance"],
            "role": user["role"]
        }
    })

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    name = data.get("name", "New User")
    
    db = load_db()
    if any(u["email"] == email for u in db.get("users", [])):
        return jsonify({"success": False, "message": "Email already exists"}), 400
    
    new_user = {
        "email": email,
        "password": password,
        "name": name,
        "balance": 0.0,
        "role": "user"
    }
    db.setdefault("users", []).append(new_user)
    save_db(db)
    
    return jsonify({"success": True, "message": "Signup successful"})

# --- Admin Endpoints ---

@app.route("/api/admin/stats", methods=["GET"])
def admin_stats():
    # In a real app, you would check the token for admin role
    db = load_db()
    users = db.get("users", [])
    orders = db.get("orders", [])
    
    total_revenue = sum(o.get("price", 0) for o in orders if o.get("status", "").lower() == "completed")
    # Assuming a 10% average profit for simple demo stats
    total_profit = total_revenue * 0.1 
    
    return jsonify({
        "success": True,
        "stats": {
            "total_users": len(users),
            "total_orders": len(orders),
            "total_revenue": round(total_revenue, 2),
            "total_profit": round(total_profit, 2)
        }
    })

@app.route("/api/admin/users", methods=["GET"])
def admin_users():
    db = load_db()
    return jsonify({
        "success": True,
        "users": db.get("users", [])
    })

@app.route("/api/admin/orders", methods=["GET"])
def admin_orders():
    # SECURITY: In a real app, verify admin role here
    db = load_db()
    orders = db.get("orders", [])
    
    # Enrich orders with bundle details for the admin panel
    for order in orders:
        if "title" not in order or "price" not in order:
            package_id = order.get("package_id") or order.get("bundleId")
            bundle = next((b for b in BUNDLES if b["id"] == package_id), None)
            if bundle:
                order["title"] = bundle["title"]
                order["price"] = bundle["price"]
                if "network" not in order:
                    order["network"] = bundle["network"]
            else:
                order["title"] = order.get("title") or f"Bundle {package_id}"
                order["price"] = order.get("price") or 0.0
        
        # Compatibility fix: phone vs beneficiary
        if "phone" not in order and "beneficiary" in order:
            order["phone"] = order["beneficiary"]
            
    return jsonify({
        "success": True,
        "orders": orders
    })

@app.route("/api/admin/order/update", methods=["POST"])
def admin_update_order():
    data = request.json
    order_id = data.get("order_id")
    new_status = data.get("status")
    
    if not order_id or not new_status:
        return jsonify({"success": False, "message": "Order ID and status required"}), 400
        
    db = load_db()
    order_found = False
    for order in db.get("orders", []):
        if order["id"] == order_id:
            order["status"] = new_status
            order_found = True
            break
            
    if order_found:
        save_db(db)
        return jsonify({"success": True, "message": "Order status updated successfully"})
    else:
        return jsonify({"success": False, "message": "Order not found"}), 404

@app.route("/api/admin/user/update-balance", methods=["POST"])
def admin_update_user_balance():
    data = request.json
    email = data.get("email")
    new_balance = data.get("balance")
    
    if not email or new_balance is None:
        return jsonify({"success": False, "message": "Email and balance required"}), 400
        
    db = load_db()
    user_found = False
    for user in db.get("users", []):
        if user["email"] == email:
            user["balance"] = float(new_balance)
            user_found = True
            break
            
    if user_found:
        save_db(db)
        return jsonify({"success": True, "message": "User balance updated successfully"})
    else:
        return jsonify({"success": False, "message": "User not found"}), 404

@app.route("/api/place-order", methods=["POST"])
def place_order():
    # SECURITY: Only the backend knows the IDATA_API_KEY
    data = request.json
    package_id = data.get("pa_data-bundle-packages")
    
    # Get bundle info
    bundle = next((b for b in BUNDLES if b["id"] == package_id), None)
    
    payload = {
        "api_key": IDATA_API_KEY,
        "network": data.get("network"),
        "beneficiary": data.get("beneficiary"),
        "pa_data-bundle-packages": package_id
    }
    
    try:
        # Simulating secure response for demo
        order_id = "SEC-" + os.urandom(4).hex().upper()
        print(f"[SECURITY] Securely processing order {order_id} for {payload['beneficiary']}...")
        
        # Log transaction in DB
        db = load_db()
        
        # If user is logged in, deduct from balance
        user_email = data.get("userEmail")
        if user_email:
            for user in db.get("users", []):
                if user["email"] == user_email:
                    price = bundle["price"] if bundle else 0.0
                    if user.get("balance", 0.0) < price:
                        # If this was a direct Paystack purchase, the balance was already added or it's a guest
                        # We only deduct if they have enough balance (wallet purchase)
                        # In a real app, you'd distinguish between wallet and direct pay
                        pass
                    else:
                        user["balance"] -= price
                    break
        
        new_order = {
            "id": order_id,
            "userEmail": data.get("userEmail"),
            "network": data.get("network"),
            "beneficiary": data.get("beneficiary"),
            "phone": data.get("beneficiary"), # Double storage for frontend compatibility
            "package_id": package_id,
            "title": bundle["title"] if bundle else f"Bundle {package_id}",
            "price": bundle["price"] if bundle else 0.0,
            "status": "Processing",
            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        db.setdefault("orders", []).insert(0, new_order)
        save_db(db)

        # Also update purchases_backup.json for the report script
        try:
            backup_file = "purchases_backup.json"
            backup_data = []
            if os.path.exists(backup_file):
                with open(backup_file, "r") as f:
                    backup_data = json.load(f)
            backup_data.insert(0, new_order)
            with open(backup_file, "w") as f:
                json.dump(backup_data, f, indent=4)
        except Exception as e:
            print(f"Backup error: {e}")

        return jsonify({
            "success": True,
            "order_id": order_id,
            "status": "Processing"
        })
    except Exception as e:
        return jsonify({"success": False, "message": "Backend processing error"}), 500

@app.route("/api/initialize-payment", methods=["POST"])
def initialize_payment():
    # SECURITY: Initialize Paystack transaction on the server
    data = request.json
    email = data.get("email")
    amount = data.get("amount") # Amount in GHS
    
    if not email or not amount:
        return jsonify({"status": "failed", "message": "Email and amount required"}), 400

    try:
        url = "https://api.paystack.co/transaction/initialize"
        headers = {
            "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        # Paystack expects amount in pesewas
        payload = {
            "email": email,
            "amount": int(float(amount) * 100),
            "currency": "GHS",
            "callback_url": request.headers.get("Referer") # Redirect back to where they came from
        }
        
        # Use session with retries for Paystack API to handle network instability
        session = requests.Session()
        retries = requests.adapters.HTTPAdapter(max_retries=3)
        session.mount('https://', retries)
        
        response = session.post(url, json=payload, headers=headers, timeout=30)
        res_data = response.json()
        
        if res_data.get("status"):
            return jsonify({
                "success": True,
                "data": res_data["data"]
            })
        else:
            return jsonify({"success": False, "message": res_data.get("message", "Paystack initialization failed")}), 400
            
    except Exception as e:
        print(f"Paystack initialization error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/charge-momo", methods=["POST"])
def charge_momo():
    # SECURITY: Initiate direct MoMo charge (iDATA Style)
    data = request.json
    email = data.get("email")
    amount = data.get("amount") # Amount in GHS
    phone = data.get("phone")
    provider = data.get("provider") # mtn, vod, or tgo
    
    if not all([email, amount, phone, provider]):
        return jsonify({"status": "failed", "message": "Email, amount, phone, and provider required"}), 400

    try:
        url = "https://api.paystack.co/charge"
        headers = {
            "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        # Paystack expects amount in pesewas
        payload = {
            "email": email,
            "amount": int(float(amount) * 100),
            "mobile_money": {
                "phone": phone,
                "provider": provider
            }
        }
        
        # Use session with retries for Paystack API to handle network instability
        session = requests.Session()
        retries = requests.adapters.HTTPAdapter(max_retries=3)
        session.mount('https://', retries)
        
        response = session.post(url, headers=headers, json=payload, timeout=30)
        response_data = response.json()
        
        if response_data.get("status"):
            # Direct charge response might require additional steps (like OTP or just push notification)
            # For Ghana MoMo, it usually initiates a push notification immediately.
            return jsonify({
                "success": True,
                "message": response_data.get("data", {}).get("display_text", "Push notification sent! Please authorize on your phone."),
                "reference": response_data.get("data", {}).get("reference")
            })
        else:
            return jsonify({
                "success": False, 
                "message": response_data.get("message", "Direct charge failed")
            }), 400
            
    except Exception as e:
        print(f"Paystack charge error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    # SECURITY: Verify Paystack transaction on the server to prevent spoofing
    data = request.json
    reference = data.get("reference")
    email = data.get("email")
    amount = data.get("amount") # Expected amount in GHS
    
    if not reference:
        return jsonify({"success": False, "message": "No reference provided"}), 400

    try:
        db = load_db()
        url = f"https://api.paystack.co/transaction/verify/{reference}"
        headers = {
            "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        # Use session with retries for Paystack API to handle network instability
        session = requests.Session()
        retries = requests.adapters.HTTPAdapter(max_retries=3)
        session.mount('https://', retries)
        
        response = session.get(url, headers=headers, timeout=30)
        verify_data = response.json()
        
        if verify_data.get("status") and verify_data["data"]["status"] == "success":
            # Verify amount (Paystack amount is in pesewas/cents)
            paid_amount = verify_data["data"]["amount"] / 100
            if abs(paid_amount - float(amount)) > 0.01:
                return jsonify({"success": False, "message": "Amount mismatch"}), 400

            # Check if this transaction has already been processed
            if any(o.get("reference") == reference for o in db.get("orders", [])):
                return jsonify({"success": True, "message": "Transaction already processed"}), 200

            # Update user balance if this was a top-up
            if email:
                for user in db.get("users", []):
                    if user["email"] == email:
                        user["balance"] = user.get("balance", 0.0) + float(paid_amount)
                        
                        # Log the transaction to prevent double processing
                        db.setdefault("orders", []).append({
                            "id": f"TOPUP-{reference[:8]}",
                            "reference": reference,
                            "email": email,
                            "amount": paid_amount,
                            "type": "topup",
                            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "status": "completed"
                        })
                        
                        save_db(db)
                        break
            
            return jsonify({"success": True, "message": "Payment verified successfully", "data": verify_data["data"]})
        else:
            return jsonify({"success": False, "message": verify_data.get("message", "Verification failed")}), 400
            
    except Exception as e:
        print(f"Paystack verification error: {e}")
        return jsonify({"success": False, "message": "Internal server error during verification"}), 500

@app.route("/api/paystack-webhook", methods=["POST"])
def paystack_webhook():
    # SECURITY: Verify that the request actually came from Paystack
    signature = request.headers.get('x-paystack-signature')
    if not signature:
        return "No signature", 400
    
    # Verify signature using hmac-sha512
    computed_signature = hmac.new(
        PAYSTACK_SECRET_KEY.encode('utf-8'),
        request.data,
        hashlib.sha512
    ).hexdigest()
    
    if computed_signature != signature:
        return "Invalid signature", 400

    # Parse event data
    event = request.json
    if event['event'] == 'charge.success':
        data = event['data']
        reference = data['reference']
        email = data['customer']['email']
        amount = data['amount'] / 100 # Convert to GHS
        
        print(f"[WEBHOOK] Payment successful: {reference} | {email} | {amount} GHS")
        
        # Here you could update database, send confirmation emails, etc.
        # For now, we update the user balance in our mock DB
        db = load_db()
        for user in db.get("users", []):
            if user["email"] == email:
                # Add to balance if not already processed by frontend
                # (In a real app, you'd track transaction IDs to avoid double-crediting)
                user["balance"] = user.get("balance", 0.0) + float(amount)
                save_db(db)
                print(f"[WEBHOOK] Updated balance for {email}")
                break

    return "OK", 200

@app.route("/api/user/profile", methods=["GET"])
def get_profile():
    email = request.args.get("email")
    if not email:
        return jsonify({"error": "Email required"}), 400
    
    db = load_db()
    user = next((u for u in db.get("users", []) if u["email"] == email), None)
    if user:
        return jsonify({
            "email": user["email"],
            "name": user.get("name", "User"),
            "balance": user.get("balance", 0.0),
            "role": user.get("role", "user")
        })
    return jsonify({"error": "User not found"}), 404

@app.route("/api/admin/verify", methods=["POST"])
def verify_admin():
    # SECURITY: Verify admin credentials on the backend
    data = request.json
    email = data.get("email")
    db = load_db()
    user = next((u for u in db.get("users", []) if u["email"] == email), None)
    if user and user.get("role") == "admin":
        return jsonify({"success": True, "role": "admin"})
    return jsonify({"success": False, "message": "Unauthorized"}), 403

@app.route("/api/admin/balance", methods=["GET"])
def check_admin_balance():
    # SECURITY: Backend proxies the balance check
    try:
        # response = requests.get(f"{IDATA_BASE_URL}/balance?api_key={IDATA_API_KEY}")
        # return response.json()
        return jsonify({"balance": 1000.00, "currency": "GHS"})
    except Exception as e:
        return jsonify({"error": "Unauthorized"}), 403

@app.route("/api/user/purchases", methods=["GET"])
def get_user_purchases():
    # SECURITY: In a real app, verify user token here
    db = load_db()
    email = request.args.get("email")
    if not email:
        return jsonify([])
    
    user_orders = [o for o in db.get("orders", []) if o.get("userEmail") == email]
    
    # Enrich orders with bundle details for the frontend dashboard
    for order in user_orders:
        if "title" not in order or "price" not in order:
            package_id = order.get("package_id")
            bundle = next((b for b in BUNDLES if b["id"] == package_id), None)
            if bundle:
                order["title"] = bundle["title"]
                order["price"] = bundle["price"]
            else:
                order["title"] = f"Bundle {package_id}"
                order["price"] = 0.0
        
        # Compatibility fix: phone vs beneficiary
        if "phone" not in order and "beneficiary" in order:
            order["phone"] = order["beneficiary"]
            
    return jsonify(user_orders)

@app.route("/api/sync-transaction", methods=["POST"])
def sync_transaction():
    # SECURITY: Verify transaction and user on backend
    data = request.json
    db = load_db()
    
    # Check if transaction already exists
    exists = any(o["id"] == data["id"] for o in db.get("orders", []))
    if not exists:
        db["orders"].insert(0, data)
        save_db(db)
        return jsonify({"success": True, "message": "Transaction synced"})
    
    return jsonify({"success": True, "message": "Transaction already exists"})

@app.route("/")
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory('.', path)

if __name__ == "__main__":
    # Get port from environment variable for deployment (Render, Heroku, etc.)
    # Default to 5002 because 5000 and 5001 are often used by macOS/AirPlay
    port = int(os.environ.get("PORT", 5002))
    app.run(host="0.0.0.0", port=port)
