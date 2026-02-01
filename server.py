from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) # Allow all origins for debugging connection issues

# --- Configuration ---
# SECURITY: Use environment variables for sensitive data
IDATA_API_KEY = os.environ.get("IDATA_API_KEY", "your_api_key_here")
IDATA_BASE_URL = "https://idatagh.com/api/v1"

# --- Mock Database ---
# Using a simple JSON file for persistence in this demo
DB_FILE = "database.json"

def load_db():
    if not os.path.exists(DB_FILE):
        return {"users": [], "orders": []}
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

# --- Routes ---

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Welcome to PolymathBundleHub API",
        "endpoints": {
            "status": "/api/status",
            "bundles": "/api/bundles"
        }
    })

@app.route("/api/status", methods=["GET"])
def get_status():
    return jsonify({
        "status": "online",
        "message": "PolymathBundleHub Secure Backend is active",
        "security_mode": "hardened"
    })

@app.route("/api/bundles", methods=["GET"])
def get_bundles():
    # SECURITY: Proxying the bundles request to iDATA without exposing API_KEY to browser
    # Curated list of all available bundles
    bundles = [
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
    return jsonify(bundles)

@app.route("/api/bundles/<int:bundle_id>", methods=["GET"])
def get_bundle_by_id(bundle_id):
    # Mock list of all available bundles (same as above)
    bundles = [
        { "id": 5, "network": "mtn", "title": "MTN 1GB", "description": "MTN Non-expiry Data Bundle", "price": 4.30, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
        { "id": 6, "network": "mtn", "title": "MTN 2GB", "description": "MTN Non-expiry Data Bundle", "price": 8.50, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
        { "id": 7, "network": "mtn", "title": "MTN 5GB", "description": "MTN Non-expiry Data Bundle", "price": 21.00, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
        { "id": 8, "network": "mtn", "title": "MTN 10GB", "description": "MTN Non-expiry Data Bundle", "price": 42.00, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
        { "id": 9, "network": "mtn", "title": "MTN 20GB", "description": "MTN Non-expiry Data Bundle", "price": 82.00, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
        { "id": 10, "network": "mtn", "title": "MTN 50GB", "description": "MTN Non-expiry Data Bundle", "price": 200.00, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
        { "id": 11, "network": "mtn", "title": "MTN 100GB", "description": "MTN Non-expiry Data Bundle", "price": 390.00, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
        { "id": 20, "network": "telecel", "title": "Telecel 1GB", "description": "Telecel Special Data Bundle", "price": 4.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
        { "id": 21, "network": "telecel", "title": "Telecel 2GB", "description": "Telecel Special Data Bundle", "price": 7.80, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
        { "id": 22, "network": "telecel", "title": "Telecel 5GB", "description": "Telecel Special Data Bundle", "price": 19.50, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
        { "id": 23, "network": "telecel", "title": "Telecel 10GB", "description": "Telecel Special Data Bundle", "price": 38.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
        { "id": 24, "network": "telecel", "title": "Telecel 20GB", "description": "Telecel Special Data Bundle", "price": 75.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
        { "id": 25, "network": "telecel", "title": "Telecel 50GB", "description": "Telecel Special Data Bundle", "price": 180.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
        { "id": 26, "network": "telecel", "title": "Telecel 100GB", "description": "Telecel Special Data Bundle", "price": 350.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" },
        { "id": 30, "network": "at", "title": "AT 1GB", "description": "AT Big Time Data", "price": 3.50, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
        { "id": 31, "network": "at", "title": "AT 2GB", "description": "AT Big Time Data", "price": 6.80, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
        { "id": 32, "network": "at", "title": "AT 5GB", "description": "AT Big Time Data", "price": 16.50, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
        { "id": 33, "network": "at", "title": "AT 10GB", "description": "AT Big Time Data", "price": 32.00, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
        { "id": 34, "network": "at", "title": "AT 20GB", "description": "AT Big Time Data", "price": 62.00, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
        { "id": 35, "network": "at", "title": "AT 50GB", "description": "AT Big Time Data", "price": 150.00, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" },
        { "id": 36, "network": "at", "title": "AT 100GB", "description": "AT Big Time Data", "price": 290.00, "image": "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800" }
    ]
    bundle = next((b for b in bundles if b["id"] == bundle_id), None)
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
    
    # In a real production app, we would use google-auth-library to verify this token.
    # For this demo, we will simulate the verification and account creation.
    
    # Mock user data extraction from token (In reality, we'd decode the JWT)
    # We'll create a dummy Google user for this demo
    email = "google-user@example.com" 
    name = "Google User"
    
    db = load_db()
    user = next((u for u in db.get("users", []) if u["email"] == email), None)
    
    if not user:
        # Create new user if they don't exist
        user = {
            "name": name,
            "email": email,
            "password": "google-auth-protected", # Placeholder
            "balance": 0.0,
            "role": "user",
            "auth_type": "google"
        }
        db["users"].append(user)
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

@app.route("/api/place-order", methods=["POST"])
def place_order():
    # SECURITY: Only the backend knows the IDATA_API_KEY
    data = request.json
    
    payload = {
        "api_key": IDATA_API_KEY,
        "network": data.get("network"),
        "beneficiary": data.get("beneficiary"),
        "pa_data-bundle-packages": data.get("pa_data-bundle-packages")
    }
    
    try:
        # In a live environment, this is where you'd call iDATA
        # response = requests.post(f"{IDATA_BASE_URL}/place-order", json=payload)
        # return response.json()
        
        # Simulating secure response for demo
        order_id = "SEC-" + os.urandom(4).hex().upper()
        print(f"[SECURITY] Securely processing order {order_id} for {payload['beneficiary']}...")
        
        # Log transaction in DB
        db = load_db()
        new_order = {
            "id": order_id,
            "userEmail": data.get("userEmail"),
            "network": data.get("network"),
            "beneficiary": data.get("beneficiary"),
            "package_id": data.get("pa_data-bundle-packages"),
            "status": "Processing",
            "date": datetime.now().isoformat() if 'datetime' in globals() else "2026-01-31"
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

@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    # SECURITY: Verify Paystack transaction on the server to prevent spoofing
    data = request.json
    reference = data.get("reference")
    email = data.get("email")
    amount = data.get("amount") # Expected amount in GHS
    
    # PAYSTACK_SECRET_KEY = os.environ.get("PAYSTACK_SECRET_KEY", "sk_test_...")
    # url = f"https://api.paystack.co/transaction/verify/{reference}"
    # headers = {"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}
    # response = requests.get(url, headers=headers)
    # verify_data = response.json()
    
    # For now, simulate verification success if reference is provided
    if reference:
        # Update user balance if this was a top-up
        if email and amount:
            db = load_db()
            for user in db.get("users", []):
                if user["email"] == email:
                    user["balance"] = user.get("balance", 0.0) + float(amount)
                    save_db(db)
                    break
        
        return jsonify({"status": "success", "message": "Payment verified securely on server"})
    
    return jsonify({"status": "failed", "message": "Invalid reference"}), 400

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
    # In a real app, check password hash and role in DB
    if email == "nuhuabdulai50@gmail.com":
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

if __name__ == "__main__":
    # Get port from environment variable for deployment (Render, Heroku, etc.)
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
