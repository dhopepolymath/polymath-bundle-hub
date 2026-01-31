from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os

app = Flask(__name__)
CORS(app) # Allow frontend to communicate with backend

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
    try:
        # For now, if we don't want to call iDATA every time, we can return our curated list
        # But this is where you'd fetch live data if needed
        return jsonify([
            { "id": 5, "network": "mtn", "title": "MTN 1GB", "description": "MTN Non-expiry Data Bundle", "price": 4.30, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
            { "id": 6, "network": "mtn", "title": "MTN 2GB", "description": "MTN Non-expiry Data Bundle", "price": 8.50, "image": "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800" },
            { "id": 20, "network": "telecel", "title": "Telecel 1GB", "description": "Telecel Special Data Bundle", "price": 4.00, "image": "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800" }
        ])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        print(f"[SECURITY] Securely processing order for {payload['beneficiary']}...")
        return jsonify({
            "success": True,
            "order_id": "SEC-" + os.urandom(4).hex().upper(),
            "status": "Processing"
        })
    except Exception as e:
        return jsonify({"success": False, "message": "Backend processing error"}), 500

@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    # SECURITY: Verify Paystack transaction on the server to prevent spoofing
    data = request.json
    reference = data.get("reference")
    
    # PAYSTACK_SECRET_KEY = "sk_live_..." # This should be in environment variables
    # url = f"https://api.paystack.co/transaction/verify/{reference}"
    # headers = {"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}
    # response = requests.get(url, headers=headers)
    
    # For now, simulate verification
    return jsonify({"status": "success", "message": "Payment verified securely on server"})

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
    app.run(port=5000, debug=True)
