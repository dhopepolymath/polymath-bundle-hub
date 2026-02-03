from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import requests
import json
import os
import base64
import hmac
import hashlib
import time
import random
from datetime import datetime, timedelta
from functools import wraps

# Initialize Flask App
app = Flask(__name__, static_folder='.')
CORS(app, resources={r"/*": {"origins": "*"}})

# --- 1. Configuration & Security ---
SECRET_KEY = os.environ.get("SESSION_SECRET_KEY", "polymath-default-dev-secret-2024")
IDATA_API_KEY = os.environ.get("IDATA_API_KEY")
PAYSTACK_SECRET_KEY = os.environ.get("PAYSTACK_SECRET_KEY")
FLASK_ENV = os.environ.get("FLASK_ENV", "development")
DB_FILE = os.environ.get("DB_FILE", "database.json")

# Log configuration status (masked)
def log_config():
    if PAYSTACK_SECRET_KEY:
        print(f"DEBUG: Paystack Key configured: {PAYSTACK_SECRET_KEY[:7]}...")
    else:
        print("WARNING: PAYSTACK_SECRET_KEY is missing!")
    
    if IDATA_API_KEY:
        print(f"DEBUG: iDATA Key configured: {IDATA_API_KEY[:5]}...")
    else:
        print("WARNING: IDATA_API_KEY is missing!")

log_config()

# --- 2. Database Helpers ---
def load_db():
    if not os.path.exists(DB_FILE):
        default_db = {
            "users": [{
                "name": "Admin User",
                "email": "nuhuabdulai50@gmail.com",
                "password": generate_password_hash("password123"),
                "balance": 100.0,
                "role": "admin",
                "token_version": 1
            }],
            "orders": [],
            "config": {
                "markup_settings": {
                    "flat": 0.5,
                    "percent": 5,
                    "publicSurcharge": 1.0,
                    "minProfit": 0.3
                }
            }
        }
        save_db(default_db)
        return default_db
    try:
        with open(DB_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return {"users": [], "orders": [], "config": {}}

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

# --- 3. Decorators & Auth Helpers ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing', 'success': False}), 401
        
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            db = load_db()
            current_user = next((u for u in db.get("users", []) if u["email"] == data['email']), None)
            
            if not current_user:
                return jsonify({'message': 'User not found', 'success': False}), 401
            
            if data.get('token_version') != current_user.get('token_version', 1):
                return jsonify({'message': 'Session expired', 'success': False}), 401
                
            return f(current_user, *args, **kwargs)
        except Exception:
            return jsonify({'message': 'Invalid token', 'success': False}), 401
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Admin token missing', 'success': False}), 401
            
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            db = load_db()
            current_user = next((u for u in db.get("users", []) if u["email"] == data['email']), None)
            
            if not current_user or current_user.get("role") != 'admin':
                return jsonify({'message': 'Admin access required', 'success': False}), 403
                
            return f(current_user, *args, **kwargs)
        except Exception:
            return jsonify({'message': 'Invalid token', 'success': False}), 401
    return decorated

def create_token(email, token_version=1):
    return jwt.encode({
        'email': email,
        'token_version': token_version,
        'exp': datetime.utcnow() + timedelta(days=7)
    }, SECRET_KEY, algorithm="HS256")

# Rate Limiting Logic
login_attempts = {}
def check_rate_limit(email):
    now = datetime.now()
    if email not in login_attempts: return True
    attempt = login_attempts[email]
    if (now - attempt["first_attempt"]).total_seconds() > 900:
        del login_attempts[email]
        return True
    return attempt["count"] < 5

def record_login_attempt(email, success):
    if success:
        login_attempts.pop(email, None)
        return
    if email not in login_attempts:
        login_attempts[email] = {"count": 1, "first_attempt": datetime.now()}
    else:
        login_attempts[email]["count"] += 1

# --- 4. Bundles Data ---
BUNDLES = [
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

# --- 5. Auth Routes ---
@app.route("/api/signup", methods=["POST"])
def signup_user():
    data = request.json
    name, email, password = data.get("name"), data.get("email"), data.get("password")
    
    if not all([name, email, password]):
        return jsonify({"success": False, "message": "All fields required"}), 400
        
    db = load_db()
    if any(u["email"] == email for u in db["users"]):
        return jsonify({"success": False, "message": "Email already exists"}), 400
        
    new_user = {
        "name": name, "email": email, "password": generate_password_hash(password),
        "balance": 0.0, "role": "user", "token_version": 1
    }
    db["users"].append(new_user)
    save_db(db)
    
    return jsonify({"success": True, "token": create_token(email), "user": {"email": email, "name": name, "balance": 0.0, "role": "user"}})

@app.route("/api/login", methods=["POST"])
def login_user():
    data = request.json
    email, password = data.get("email"), data.get("password")
    
    if not check_rate_limit(email):
        return jsonify({"success": False, "message": "Too many attempts. Try later."}), 429
        
    db = load_db()
    user = next((u for u in db["users"] if u["email"] == email), None)
    
    if user and check_password_hash(user["password"], password):
        record_login_attempt(email, True)
        return jsonify({
            "success": True, "token": create_token(email, user.get('token_version', 1)),
            "user": {"email": user["email"], "name": user["name"], "balance": user["balance"], "role": user["role"]}
        })
    
    record_login_attempt(email, False)
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route("/api/auth/google", methods=["POST"])
def google_auth():
    token = request.json.get("token")
    try:
        payload = json.loads(base64.b64decode(token.split('.')[1] + '==').decode('utf-8'))
        email, name = payload.get("email"), payload.get("name")
        
        db = load_db()
        user = next((u for u in db["users"] if u["email"] == email), None)
        if not user:
            user = {"name": name, "email": email, "password": generate_password_hash(os.urandom(16).hex()), "balance": 0.0, "role": "user", "token_version": 1}
            db["users"].append(user)
            save_db(db)
            
        return jsonify({"success": True, "token": create_token(email, user.get('token_version', 1)), "user": {"email": email, "name": name, "balance": user["balance"], "role": user["role"]}})
    except Exception as e:
        return jsonify({"success": False, "message": "Google auth failed"}), 400

@app.route("/api/auth/apple", methods=["POST"])
def apple_auth():
    data = request.json
    token, user_data = data.get("identityToken"), data.get("user")
    try:
        payload = json.loads(base64.b64decode(token.split('.')[1] + '==').decode('utf-8'))
        email = payload.get("email") or (user_data.get("email") if user_data else f"{payload.get('sub')}@appleid.com")
        name = "Apple User"
        if user_data and user_data.get("name"):
            n = user_data["name"]
            name = f"{n.get('firstName', '')} {n.get('lastName', '')}".strip() or name
            
        db = load_db()
        user = next((u for u in db["users"] if u["email"] == email), None)
        if not user:
            user = {"name": name, "email": email, "password": generate_password_hash(os.urandom(16).hex()), "balance": 0.0, "role": "user", "token_version": 1}
            db["users"].append(user)
            save_db(db)
            
        return jsonify({"success": True, "token": create_token(email, user.get('token_version', 1)), "user": {"email": email, "name": name, "balance": user["balance"], "role": user["role"]}})
    except Exception:
        return jsonify({"success": False, "message": "Apple auth failed"}), 400

# --- 6. Admin Endpoints ---
@app.route("/api/admin/verify", methods=["POST"])
@admin_required
def admin_verify(current_user):
    return jsonify({"success": True})

@app.route("/api/admin/stats", methods=["GET"])
@admin_required
def admin_stats(current_user):
    db = load_db()
    orders = db.get("orders", [])
    revenue = sum(o.get("price", 0) for o in orders if o.get("status") == "completed")
    return jsonify({
        "success": True,
        "stats": {"total_users": len(db["users"]), "total_orders": len(orders), "total_revenue": round(revenue, 2), "total_profit": round(revenue * 0.1, 2)}
    })

@app.route("/api/admin/users", methods=["GET"])
@admin_required
def admin_get_users(current_user):
    db = load_db()
    users = [{k: v for k, v in u.items() if k != 'password'} for u in db["users"]]
    return jsonify({"success": True, "users": users})

@app.route("/api/admin/orders", methods=["GET"])
@admin_required
def admin_get_orders(current_user):
    db = load_db()
    orders = db.get("orders", [])
    for o in orders:
        bundle = next((b for b in BUNDLES if b["id"] == (o.get("package_id") or o.get("bundleId"))), None)
        if bundle:
            o["title"] = bundle["title"]
            o["price"] = bundle["price"]
    return jsonify({"success": True, "orders": orders})

@app.route("/api/admin/order/update", methods=["POST"])
@admin_required
def admin_update_order(current_user):
    data = request.json
    db = load_db()
    for o in db["orders"]:
        if o["id"] == data["order_id"]:
            o["status"] = data["status"]
            break
    save_db(db)
    return jsonify({"success": True})

@app.route("/api/admin/user/update-balance", methods=["POST"])
@admin_required
def admin_update_balance(current_user):
    data = request.json
    db = load_db()
    for u in db["users"]:
        if u["email"] == data["email"]:
            u["balance"] = float(data["balance"])
            break
    save_db(db)
    return jsonify({"success": True})

@app.route("/api/admin/config", methods=["GET"])
@admin_required
def admin_get_config(current_user):
    db = load_db()
    return jsonify({"success": True, "markup_settings": db.get("config", {}).get("markup_settings", {})})

@app.route("/api/admin/config/update", methods=["POST"])
@admin_required
def admin_update_config(current_user):
    data = request.json
    db = load_db()
    db.setdefault("config", {})["markup_settings"] = data.get("markup_settings")
    save_db(db)
    return jsonify({"success": True})

@app.route("/api/admin/balance", methods=["GET"])
@admin_required
def admin_check_idata_balance(current_user):
    if not IDATA_API_KEY: return jsonify({"success": False, "message": "Key missing"}), 500
    try:
        res = requests.get(f"https://idatagh.com/wp-json/custom/v1/balance?api_key={IDATA_API_KEY}", timeout=10)
        return jsonify(res.json())
    except Exception:
        return jsonify({"success": False, "message": "iDATA connection failed"}), 500

# --- 7. Payment Endpoints ---
@app.route("/api/initialize-payment", methods=["POST"])
def init_payment():
    if not PAYSTACK_SECRET_KEY: return jsonify({"success": False, "message": "Paystack key missing"}), 500
    data = request.json
    try:
        res = requests.post("https://api.paystack.co/transaction/initialize", 
            json={"email": data["email"], "amount": int(float(data["amount"]) * 100), "currency": "GHS"},
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}, timeout=20)
        return jsonify({"success": True, "data": res.json()["data"]})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/charge-momo", methods=["POST"])
def charge_momo():
    if not PAYSTACK_SECRET_KEY: return jsonify({"success": False, "message": "Key missing"}), 500
    data = request.json
    try:
        payload = {
            "email": data["email"], "amount": int(float(data["amount"]) * 100), "currency": "GHS",
            "mobile_money": {"phone": data["phone"], "provider": data["provider"]}
        }
        res = requests.post("https://api.paystack.co/charge", json=payload, 
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}, timeout=20)
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    ref = request.json.get("reference")
    try:
        res = requests.get(f"https://api.paystack.co/transaction/verify/{ref}", 
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}, timeout=20)
        return jsonify(res.json())
    except Exception:
        return jsonify({"success": False, "message": "Verification failed"}), 500

# --- 8. User & General Routes ---
@app.route("/api/bundles", methods=["GET"])
def get_all_bundles():
    return jsonify(BUNDLES)

@app.route("/api/user/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    return jsonify({"email": current_user["email"], "name": current_user["name"], "balance": current_user["balance"], "role": current_user["role"]})

@app.route("/api/user/purchases", methods=["GET"])
def get_purchases():
    email = request.args.get("email")
    db = load_db()
    orders = [o for o in db.get("orders", []) if o.get("userEmail") == email]
    return jsonify(orders)

@app.route("/api/sync-transaction", methods=["POST"])
def sync_tx():
    data = request.json
    db = load_db()
    if not any(o["id"] == data["id"] for o in db["orders"]):
        db["orders"].insert(0, data)
        save_db(db)
    return jsonify({"success": True})

@app.route("/")
def index():
    return send_from_directory('.', 'index.html')

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory('.', path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5002))
    app.run(host="0.0.0.0", port=port)
