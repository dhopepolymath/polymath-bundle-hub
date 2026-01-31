import json
import os
from datetime import datetime

def generate_report():
    # Load order history from the project's localStorage-like storage (simulated here)
    # In a real app, this would read from a database
    history_file = "purchases_backup.json"
    
    if not os.path.exists(history_file):
        print("No purchase history found to generate report.")
        # Create dummy data for demonstration
        dummy_data = [
            {"id": "TXN-001", "title": "MTN 1GB", "price": 10.5, "cost": 8.0, "date": "2026-01-25"},
            {"id": "TXN-002", "title": "Telecel 2GB", "price": 15.0, "cost": 12.0, "date": "2026-01-26"},
            {"id": "TXN-003", "title": "MTN 5GB", "price": 35.0, "cost": 30.0, "date": "2026-01-27"},
        ]
        with open(history_file, "w") as f:
            json.dump(dummy_data, f, indent=4)
        print("Created sample data in purchases_backup.json")

    with open(history_file, "r") as f:
        purchases = json.load(f)

    total_revenue = sum(p['price'] for p in purchases)
    total_cost = sum(p.get('cost', p['price'] * 0.8) for p in purchases) # fallback if cost missing
    total_profit = total_revenue - total_cost
    
    print("\n" + "="*40)
    print(f"POLYMATH BUNDLE HUB - SALES REPORT")
    print(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*40)
    print(f"Total Transactions: {len(purchases)}")
    print(f"Total Revenue:      GHS {total_revenue:,.2f}")
    print(f"Total Cost:         GHS {total_cost:,.2f}")
    print(f"Net Profit:         GHS {total_profit:,.2f}")
    print("-" * 40)
    print("Top Performing Bundles:")
    
    bundle_stats = {}
    for p in purchases:
        title = p['title']
        bundle_stats[title] = bundle_stats.get(title, 0) + 1
    
    for title, count in sorted(bundle_stats.items(), key=lambda x: x[1], reverse=True):
        print(f"- {title}: {count} sales")
    print("="*40 + "\n")

if __name__ == "__main__":
    generate_report()
