# Data Sync Setup Guide

## Overview
The Pantry Tracker app now supports cloud sync functionality! When logged in, your products are automatically synced across all devices.

## Backend Setup

### 1. Run the Migration
First, create the products table in your PostgreSQL database:

```bash
cd "c:\React Learning\react-native-app server"
node migrations/20250919-create_products_table.js
```

### 2. Start the Server
Make sure your backend server is running:

```bash
npm start
```

The server should be running on `http://localhost:8080` (or your configured port).

### 3. Update API URL
In `Pantry-Tracker/services/productService.ts`, update the API_URL to match your server:

```typescript
const API_URL = 'http://YOUR_SERVER_IP:8080';
```

For local development:
- Android Emulator: `http://10.0.2.2:8080`
- iOS Simulator: `http://localhost:8080`
- Physical Device: `http://YOUR_LOCAL_IP:8080` (e.g., `http://192.168.1.117:8080`)

## API Endpoints

All endpoints require authentication (JWT token).

### Products Endpoints

```
GET    /products           - Get all products for logged-in user
GET    /products/:id       - Get single product by ID
POST   /products           - Create/update single product (upsert by barcode)
PATCH  /products/:id       - Update product by ID
DELETE /products/:id       - Delete product by ID
POST   /products/sync      - Batch sync multiple products
```

## How Sync Works

### Automatic Sync (When Logged In)

1. **Scanning Products**: When you scan and save a product while logged in, it automatically saves to:
   - Local AsyncStorage (works offline)
   - Cloud database (if connected)

2. **Updating Products**: Any changes to products (expiration date, alert settings) are automatically synced to the cloud.

3. **Deleting Products**: Deletions are tracked locally and will be reconciled on next manual sync.

### Manual Sync (Profile Screen)

1. Go to the **Profile** tab
2. Press the **🔄 Sync Data** button
3. The app will:
   - Download all products from the server
   - Upload any local products not on the server
   - Merge everything (server data takes priority for duplicates)
   - Display sync results

### Sync Strategy

- **Server products take priority** over local products when barcodes match
- **Local products not on server** are uploaded during sync
- **Duplicates are ignored** based on barcode
- **Offline capability**: Products save locally first, sync when connected

## Product Data Structure

Products are stored with the following fields:

```typescript
{
  barcode: string,              // Required - unique identifier
  product_name?: string,        // Product name
  brands?: string,              // Brand names
  image_url?: string,           // Product image URL
  categories?: string,          // Product categories
  ingredients_text?: string,    // Ingredients list
  nutrition_grade?: string,     // A-E nutrition grade
  quantity?: string,            // Package quantity
  calories?: number,            // Calories per 100g (rounded to 2 decimals)
  expiration_date?: string,     // ISO date string
  alert_days_before?: number,   // Days before expiration to alert (default: 1)
  scanned_at?: string          // ISO date string of scan time
}
```

## Testing Sync

### Test Flow:

1. **Without Login**:
   - Scan products → Saves locally only
   - Products only on device

2. **After Login**:
   - Go to Profile → Press "Sync Data"
   - Local products upload to cloud
   - Can now access on other devices

3. **New Scans**:
   - Scan new product → Saves to cloud automatically
   - Shows "synced to cloud ☁️" message

4. **On Another Device**:
   - Login with same account
   - Press "Sync Data"
   - All products download and merge

## Troubleshooting

### Sync Fails
- Check internet connection
- Verify server is running
- Check API_URL matches your server
- Ensure you're logged in (token is valid)
- Check console for error messages

### Products Not Appearing
- Try manual sync from Profile screen
- Check AsyncStorage has products locally
- Verify backend database has products
- Check user_id matches logged-in user

### Duplicate Products & Multiple Expiration Lots
Previously, the system prevented duplicates strictly by barcode. After migration `20251117-alter_products_unique_constraint`, you can have multiple entries for the same barcode with different expiration dates (separate lots/batches).

Current behavior:
- Scanning the same barcode with a different expiration date creates a new local entry.
- Server stores each (user_id, barcode, expiration_date) combination separately.
- The existing merge logic still collapses server rows by barcode; this will be updated.

Planned enhancement:
- Merge routine will use a composite key (barcode + expiration_date) to preserve distinct lots.

## Database Schema

```sql
-- Updated uniqueness: multiple lots of same barcode with distinct expiration dates.
CREATE TABLE products (
   id SERIAL PRIMARY KEY,
   user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   barcode VARCHAR(255) NOT NULL,
   product_name VARCHAR(255),
   brands VARCHAR(255),
   image_url TEXT,
   categories TEXT,
   ingredients_text TEXT,
   nutrition_grade VARCHAR(10),
   quantity VARCHAR(100),
   calories DECIMAL(10, 2),
   expiration_date TIMESTAMP,
   alert_days_before INTEGER DEFAULT 1,
   scanned_at TIMESTAMP NOT NULL DEFAULT NOW(),
   created_at TIMESTAMP NOT NULL DEFAULT NOW(),
   updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
-- Unique index applied via migration:
-- CREATE UNIQUE INDEX products_user_id_barcode_expiration_uidx ON products(user_id, barcode, expiration_date);
```

## Features

✅ Automatic cloud sync when logged in
✅ Manual sync button on profile screen
✅ Offline support (saves locally first)
✅ Supports multiple expiration lots per barcode
✅ Batch sync optimization
✅ Real-time sync status messages
✅ Cross-device compatibility

## Next Steps

Consider adding:
- Auto-sync on app launch when logged in
- Conflict resolution for simultaneous edits
- Sync indicator in UI
- Last sync timestamp display
- Pull-to-refresh on index screen to sync
