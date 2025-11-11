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

      console.log('Syncing products:', products.length);
      const response = await fetch(`${API_URL}/products/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ products }),
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

      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(product),
      });

      if (!response.ok) {
        throw new Error('Failed to save product');
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
      
      // Get local products
      const localProductsJson = await AsyncStorage.getItem('scannedProducts');
      const localProducts = localProductsJson ? JSON.parse(localProductsJson) : [];

      // Create a map of server products by barcode
      const serverProductMap = new Map();
      serverProducts.forEach(product => {
        serverProductMap.set(product.barcode, product);
      });

      // Merge: prioritize server data, add local products not on server
      const merged = [...serverProducts];
      const serverBarcodes = new Set(serverProducts.map(p => p.barcode));

      localProducts.forEach((localProduct: any) => {
        if (!serverBarcodes.has(localProduct.barcode)) {
          merged.push(localProduct);
        }
      });

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

      // Then, upload any local products not on server
      const serverBarcodes = new Set(serverProducts.map(p => p.barcode));
      const productsToUpload = localProducts.filter(
        (product: any) => !serverBarcodes.has(product.barcode)
      );

      console.log('Products to upload:', productsToUpload.length);
      if (productsToUpload.length > 0) {
        // Log first product structure to debug
        console.log('Sample product structure:', JSON.stringify(productsToUpload[0], null, 2));
        await this.syncProducts(productsToUpload);
      }

      return {
        downloaded: serverProducts.length,
        uploaded: productsToUpload.length,
        total: merged.length
      };
    } catch (error) {
      console.error('Error during full sync:', error);
      throw error;
    }
  }
}

export default new ProductService();
