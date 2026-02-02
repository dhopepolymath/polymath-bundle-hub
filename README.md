# Polymath Bundle Hub

Polymath Bundle Hub is a robust, full-stack web application designed for purchasing data bundles. It provides a seamless experience for users to buy data and for administrators to manage the platform, with integrated payment processing and profit margin management.

## 🚀 Features

- **User Authentication**: Secure JWT-based login, registration, and Google OAuth integration.
- **Data Bundle Integration**: Real-time integration with the iData API for fetching and purchasing data packages.
- **Payment Processing**: Integrated with Paystack for secure and reliable payment transactions.
- **Profit Protection System**: Automated markup calculation to ensure consistent profit margins.
- **Admin Dashboard**: Comprehensive tools for administrators to monitor sales, generate reports, and adjust user balances.
- **Responsive Design**: A modern, mobile-friendly interface built with HTML5, CSS3, and Vanilla JavaScript.

## 🛠️ Technology Stack

- **Backend**: Python 3.x, Flask, Gunicorn
- **Security**: PyJWT (JSON Web Tokens), Werkzeug (Password Hashing)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **APIs**: [iData API](https://idatagh.com/) (Data Bundles), [Paystack API](https://paystack.com/) (Payments)
- **Database**: JSON-based persistent storage (`database.json`)

## 📂 Project Structure

- [server.py](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/server.py): Core Flask application containing all API endpoints and business logic.
- [app.js](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/app.js): Frontend application logic, state management, and API client.
- [admin_report.py](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/admin_report.py): CLI utility for generating detailed sales and profit reports.
- [style.css](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/style.css): Global styles using CSS variables for theme management.
- **Pages**: [index.html](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/index.html), [login.html](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/login.html), [dashboard.html](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/dashboard.html), [admin.html](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/admin.html), [bundles.html](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/bundles.html).

## 📡 API Documentation

### Authentication
- `POST /api/login`: Authenticate user and return JWT. Includes rate limiting (5 attempts per 15 mins).
- `POST /api/signup`: Register a new user account.
- `POST /api/auth/google`: Authenticate via Google OAuth token.

### Bundles & Purchases
- `GET /api/bundles`: Fetch available data packages (proxied from iData).
- `POST /api/buy`: Place a data bundle order. Requires `pa_data-bundle-packages`, `network`, and `beneficiary`.
- `POST /api/initialize-payment`: Create a Paystack checkout session.
- `POST /api/verify-payment`: Verify transaction status with Paystack and credit user balance.

### Admin (Requires Admin JWT)
- `GET /api/admin/stats`: Get overview of users, orders, revenue, and profit.
- `GET /api/admin/users`: List all registered users (sensitive data masked).
- `GET /api/admin/orders`: List all transaction history.
- `POST /api/admin/order/update`: Manually update an order's status (e.g., Pending -> Completed).
- `POST /api/admin/clear-history`: Permanently clear all transaction records.
- `POST /api/admin/user/update-balance`: Adjust a user's wallet balance.

## 📈 Profit Markup System

The system ensures profitability using a multi-layered formula calculated in [app.js](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/app.js):

**Formula:**
`Retail Price = Cost + (Cost * % Markup) + Flat Fee + Public Surcharge`

**Default Settings:**
- **Flat Fee**: GHS 1.50
- **Percentage**: 5%
- **Public Surcharge**: GHS 2.00 (Applied to non-logged-in users)
- **Minimum Profit**: GHS 1.00

## 🛡️ Security Implementation

1. **JWT Protection**: All sensitive endpoints use a `@token_required` or `@admin_required` decorator.
2. **Password Hashing**: Uses `pbkdf2:sha256` via Werkzeug for secure credential storage.
3. **API Masking**: Third-party API keys (iData, Paystack) are stored in `.env` and never sent to the client.
4. **Rate Limiting**: Protects login endpoints from brute-force attacks.
5. **CORS Configuration**: Restricted to allow cross-origin requests safely during development and production.

## 🚀 Deployment (Render)

The project is configured for [Render](https://render.com/) via [render.yaml](file:///Users/polymath/Desktop/Projects/data%20bundle%20hub/render.yaml).

**Environment Variables Required:**
- `SESSION_SECRET_KEY`: Random string for JWT signing.
- `IDATA_API_KEY`: Your iData Ghana API key.
- `PAYSTACK_SECRET_KEY`: Your Paystack Secret Key.
- `FLASK_ENV`: Set to `production`.

## 📊 Reporting

Run the automated report generator to see business performance:
```bash
python admin_report.py
```
This generates a summary of total transactions, revenue, and net profit directly in your terminal.

## 📄 License

Proprietary Software. All rights reserved.
