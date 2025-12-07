import AsyncStorage from '@react-native-async-storage/async-storage';
import { host } from "@/host.js"
import { getToken } from './storage';

const API_URL = host; // Update with your server IP

class ProductService {
  // Convert snake_case keys to camelCase
  private toCamelCase(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.toCamelCase(item));
    } else if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).reduce((acc, key) => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        acc[camelKey] = this.toCamelCase(obj[key]);
        return acc;
      }, {} as any);
    }
    return obj;
  }

  // Update a single product by ID with partial fields
  async updateProduct(productId: number, partial: any): Promise<any> {
    try {
      const token = await this.getAuthToken();
      if (!token) throw new Error('No authentication token');

      const bodySnake = this.toSnakeCase(partial);

      const response = await fetch(`${API_URL}/products/${productId}` , {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(bodySnake),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update product: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return this.toCamelCase(data.data);
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  // Convert camelCase keys to snake_case
  private toSnakeCase(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.toSnakeCase(item));
    } else if (obj !== null && typeof obj === 'object') {
      const result: any = {};
      
      Object.keys(obj).forEach(key => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        let value = this.toSnakeCase(obj[key]);
        
        // Convert string calories to number for backend
        if (snakeKey === 'calories' && typeof value === 'string') {
          const parsed = parseFloat(value);
          value = isNaN(parsed) ? null : parsed;
        }
        
        // Convert string alertDaysBefore to number for backend
        if (snakeKey === 'alert_days_before' && typeof value === 'string') {
          const parsed = parseInt(value);
          value = isNaN(parsed) ? 1 : parsed;
        }
        
        // Truncate nutrition_grade to 10 characters max
        if (snakeKey === 'nutrition_grade' && typeof value === 'string' && value.length > 10) {
          value = value.substring(0, 10);
        }
        
        // Ensure expiration_date is valid ISO datetime or omitted
        if (snakeKey === 'expiration_date') {
          if (!value || value === '' || value === 'undefined') {
            // Don't include the field at all if it's empty
            return;
          } else if (typeof value === 'string') {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              // Invalid date, don't include
              return;
            } else {
              // Ensure it's in strict ISO 8601 format with timezone
              value = date.toISOString();
            }
          } else {
            return;
          }
        }
        
        // Ensure scanned_at is valid ISO datetime
        if (snakeKey === 'scanned_at') {
          if (!value || value === '' || value === 'undefined') {
            value = new Date().toISOString();
          } else if (typeof value === 'string') {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              value = new Date().toISOString();
            } else {
              value = date.toISOString();
            }
          } else {
            value = new Date().toISOString();
          }
        }
        
        result[snakeKey] = value;
      });
      
      return result;
    }
    return obj;
  }

  // Get auth token from storage
  private async getAuthToken(): Promise<string | null> {
    try {
      const token = await getToken();
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Get all products from server
  async getAllProducts(): Promise<any[]> {
    try {
      const token = await this.getAuthToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${API_URL}/products`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      const products = data.data || [];
      return this.toCamelCase(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  // Sync products to server (batch upload)
  async syncProducts(products: any[]): Promise<any[]> {
    try {
      const token = await this.getAuthToken();
      if (!token) throw new Error('No authentication token');

      // Convert products to snake_case for server
      const productsSnakeCase = this.toSnakeCase(products);
      
      console.log('Syncing products:', products.length);
      console.log('Product data being sent:', JSON.stringify(productsSnakeCase[0], null, 2));
      
      const response = await fetch(`${API_URL}/products/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ products: productsSnakeCase }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sync failed with status:', response.status);
        console.error('Error response:', errorText);
        throw new Error(`Failed to sync products: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const syncedProducts = data.data || [];
      return this.toCamelCase(syncedProducts);
    } catch (error) {
      console.error('Error syncing products:', error);
      throw error;
    }
  }

  // Create or update a single product
  async upsertProduct(product: any): Promise<any> {
    try {
      const token = await this.getAuthToken();
      if (!token) throw new Error('No authentication token');

      // Convert camelCase to snake_case for server
      const productSnakeCase = this.toSnakeCase(product);
      console.log('Upserting product:', JSON.stringify(productSnakeCase, null, 2));

      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(productSnakeCase),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response error:', response.status, errorText);
        throw new Error(`Failed to save product: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return this.toCamelCase(data.data);
    } catch (error) {
      console.error('Error upserting product:', error);
      throw error;
    }
  }

  // Delete a product from server
  async deleteProduct(productId: number): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Delete a product by barcode from server
  async deleteProductByBarcode(barcode: string): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${API_URL}/products/barcode/${barcode}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product by barcode:', error);
      throw error;
    }
  }

  // Delete all products from server
  async deleteAllProducts(): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${API_URL}/products/all/clear`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete all products');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Download products from server and merge with local storage
  async downloadAndMergeProducts(): Promise<{ 
    serverProducts: any[], 
    localProducts: any[], 
    merged: any[] 
  }> {
    try {
      // Get server products
      const serverProducts = await this.getAllProducts();
      
      console.log('===== SYNC DEBUG =====');
      console.log('Server products received:', serverProducts.length);
      if (serverProducts.length > 0) {
        console.log('Sample server product:');
        console.log('  - barcode:', serverProducts[0].barcode);
        console.log('  - product_name:', serverProducts[0].product_name);
        console.log('  - image_url:', serverProducts[0].image_url);
        console.log('  - brands:', serverProducts[0].brands);
        console.log('  - calories:', serverProducts[0].calories);
        console.log('  - scannedAt:', serverProducts[0].scannedAt);
        console.log('Full product:', JSON.stringify(serverProducts[0], null, 2));
      }
      
      // Get local products
      const localProductsJson = await AsyncStorage.getItem('scannedProducts');
      const localProducts = localProductsJson ? JSON.parse(localProductsJson) : [];

      console.log('Local products before merge:', localProducts.length);
      if (localProducts.length > 0) {
        console.log('Sample local product:', JSON.stringify(localProducts[0], null, 2));
      } else {
        console.log('LOCAL STORAGE IS EMPTY - will use server data entirely');
      }

      // Build maps for quick lookup
      const serverProductMap = new Map<string, any>();
      const localProductMap = new Map<string, any>();
      serverProducts.forEach(p => { if (p && p.barcode) serverProductMap.set(p.barcode, p); });
      localProducts.forEach((p: any) => { if (p && p.barcode) localProductMap.set(p.barcode, p); });

      const allBarcodes = new Set<string>([...serverProductMap.keys(), ...localProductMap.keys()]);

      const isValidDate = (val: any) => {
        if (!val || typeof val !== 'string') return false;
        const d = new Date(val);
        return !isNaN(d.getTime());
      };

      const merged: any[] = [];
      allBarcodes.forEach(barcode => {
        const server = serverProductMap.get(barcode);
        const local = localProductMap.get(barcode);

        let result: any = {};

        // If we have local data, start with it (richer client-scanned info)
        if (local) {
          result = { ...local };
        }

        // If we have server data, merge it in
        if (server) {
          // Always take server id if present
          if (server.id) result.id = server.id;
          
          // If no local data exists (e.g., after logout), take all valid fields from server
          if (!local) {
            // Server data comes in camelCase from toCamelCase conversion
            // Map camelCase server fields to snake_case for consistency
            const fieldMap = {
              'productName': 'product_name',
              'brands': 'brands',
              'imageUrl': 'image_url',
              'calories': 'calories',
              'quantity': 'quantity',
              'nutritionGrade': 'nutrition_grade',
              'expirationDate': 'expiration_date',
              'scannedAt': 'scannedAt',
              'alertDaysBefore': 'alertDaysBefore',
              'categories': 'categories',
              'ingredientsText': 'ingredients_text'
            };
            
            Object.entries(fieldMap).forEach(([serverKey, localKey]) => {
              const v = server[serverKey];
              // Only skip truly empty values
              if (v === null || v === undefined) return;
              if (typeof v === 'string' && v.trim() === '') return;
              if (localKey === 'expiration_date' && !isValidDate(v)) return; // skip invalid date
              result[localKey] = v;
            });
          } else {
            // Local exists - selectively merge server fields using field mapping
            const fieldMap = {
              'productName': 'product_name',
              'brands': 'brands',
              'imageUrl': 'image_url',
              'calories': 'calories',
              'quantity': 'quantity',
              'nutritionGrade': 'nutrition_grade',
              'expirationDate': 'expiration_date',
              'scannedAt': 'scannedAt',
              'alertDaysBefore': 'alertDaysBefore'
            };
            
            Object.entries(fieldMap).forEach(([serverKey, localKey]) => {
              const v = server[serverKey];
              if (v === null || v === undefined || v === '') return; // skip empty
              if (localKey === 'expiration_date' && !isValidDate(v)) return; // skip invalid date from server
              // Do not overwrite with server if local already has a richer value unless missing
              if (result[localKey] === undefined || result[localKey] === null || result[localKey] === '') {
                result[localKey] = v;
              } else {
                // Prefer server for product_name and scannedAt if provided
                if (['product_name','scannedAt'].includes(localKey)) result[localKey] = v;
              }
            });
          }
        }

        // Final sanitation: drop invalid expiration
        if (result.expiration_date && !isValidDate(result.expiration_date)) {
          delete result.expiration_date;
          delete result.alertDaysBefore;
        }
        // Ensure alertDaysBefore default only when expiration exists
        if (result.expiration_date) {
          result.alertDaysBefore = result.alertDaysBefore ?? 1;
        } else {
          delete result.alertDaysBefore;
        }
        // Ensure scannedAt present (use server's or default to now)
        result.scannedAt = result.scannedAt || new Date().toISOString();
        // Barcode always retained
        result.barcode = barcode;
        merged.push(result);
      });

      console.log('Merged products:', merged.length);
      if (merged.length > 0) {
        console.log('Sample merged product:');
        console.log('  - barcode:', merged[0].barcode);
        console.log('  - product_name:', merged[0].product_name);
        console.log('  - image_url:', merged[0].image_url);
        console.log('  - brands:', merged[0].brands);
        console.log('  - calories:', merged[0].calories);
        console.log('  - scannedAt:', merged[0].scannedAt);
        console.log('Full merged:', JSON.stringify(merged[0], null, 2));
      }
      console.log('===== END SYNC DEBUG =====');

      // Save merged data to local storage
      await AsyncStorage.setItem('scannedProducts', JSON.stringify(merged));

      return {
        serverProducts,
        localProducts,
        merged
      };
    } catch (error) {
      console.error('Error downloading and merging products:', error);
      throw error;
    }
  }

  // Upload local products that don't exist on server
  async uploadLocalProducts(): Promise<{ uploaded: number }> {
    try {
      // Get server products
      const serverProducts = await this.getAllProducts();
      const serverBarcodes = new Set(serverProducts.map(p => p.barcode));

      // Get local products
      const localProductsJson = await AsyncStorage.getItem('scannedProducts');
      const localProducts = localProductsJson ? JSON.parse(localProductsJson) : [];

      // Find local products not on server
      const productsToUpload = localProducts.filter(
        (product: any) => !serverBarcodes.has(product.barcode)
      );

      if (productsToUpload.length === 0) {
        return { uploaded: 0 };
      }

      // Upload to server
      await this.syncProducts(productsToUpload);

      return { uploaded: productsToUpload.length };
    } catch (error) {
      console.error('Error uploading local products:', error);
      throw error;
    }
  }

  // Full bidirectional sync
  async fullSync(): Promise<{
    downloaded: number,
    uploaded: number,
    total: number
  }> {
    try {
      // First, download and merge server products with local
      const { serverProducts, localProducts, merged } = await this.downloadAndMergeProducts();

      // Then, upload any local products not on server AND push minimal updates for changed quantities
      const serverMap = new Map<string, any>();
      for (const sp of serverProducts) if (sp && sp.barcode) serverMap.set(sp.barcode, sp);
      const productsToUpload: any[] = [];
      const quantityUpdates: any[] = [];

      for (const lp of localProducts) {
        if (!lp || !lp.barcode) continue;
        const sp = serverMap.get(lp.barcode);
        if (!sp) {
          // Not on server: upload the full local product as-is
          productsToUpload.push(lp);
          continue;
        }
        // On server: if quantity differs (and local has a number), push minimal update
        const lq = typeof lp.quantity === 'number' ? lp.quantity : parseInt(String(lp.quantity ?? '1'), 10);
        const sq = typeof sp.quantity === 'number' ? sp.quantity : parseInt(String(sp.quantity ?? '1'), 10);
        if (!isNaN(lq) && !isNaN(sq) && lq !== sq) {
          quantityUpdates.push({ barcode: lp.barcode, quantity: lq });
        }
      }

      const payload = [...productsToUpload, ...quantityUpdates];
      console.log('Products to upload:', payload.length, ' (new:', productsToUpload.length, ', qty updates:', quantityUpdates.length, ')');
      if (payload.length > 0) {
        // Log first product structure to debug
        console.log('Sample product structure:', JSON.stringify(payload[0], null, 2));
        await this.syncProducts(payload);
      }

      return {
        downloaded: serverProducts.length,
        uploaded: payload.length,
        total: merged.length
      };
    } catch (error) {
      console.error('Error during full sync:', error);
      throw error;
    }
  }
}

export default new ProductService();
