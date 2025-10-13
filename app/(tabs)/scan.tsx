import React, { useState, useEffect, useRef } from "react";
import { Text, View, StyleSheet, Button, ActivityIndicator, Image, ScrollView } from "react-native";
import { CameraView, Camera } from "expo-camera";

interface ProductInfo {
  product_name?: string;
  brands?: string;
  image_url?: string;
  categories?: string;
  ingredients_text?: string;
  nutrition_grade?: string;
  quantity?: string;
}

export default function Scan() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [barcodeData, setBarcodeData] = useState<any>(null);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };

    getCameraPermissions();
  }, []);

  // Function to fetch product information from barcode
  const fetchProductInfo = async (barcode: string): Promise<ProductInfo | null> => {
    try {
      setLoading(true);
      setError(null);
      
      // Open Food Facts API - free and comprehensive for food products
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        return {
          product_name: data.product.product_name || data.product.product_name_en,
          brands: data.product.brands,
          image_url: data.product.image_front_url || data.product.image_url,
          categories: data.product.categories,
          ingredients_text: data.product.ingredients_text,
          nutrition_grade: data.product.nutrition_grades,
          quantity: data.product.quantity,
        };
      }
      
      return null;
    } catch (err) {
      console.error('Error fetching product info:', err);
      throw new Error('Failed to fetch product information');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = async ({ type, data, bounds }: { type: string; data: string; bounds?: any }) => {
    // Prevent multiple scans if already processed
    if (scanned) return;
    
    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    
    // Set scanned state immediately to prevent further scans
    setScanned(true);
    setBarcodeData({ type, data, bounds });
    
    // Fetch product information
    try {
      const product = await fetchProductInfo(data);
      setProductInfo(product);
      
      if (!product) {
        setError("Product not found in database");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    }
  };

  const resetScanner = () => {
    // Clear any pending timeouts
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    setScanned(false);
    setBarcodeData(null);
    setProductInfo(null);
    setError(null);
    setLoading(false);
  };

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            "upc_a",      // Most common on US/Canada food products
            "upc_e",      // Compact UPC for smaller products
            "ean13",      // European standard, used worldwide
            "ean8",       // Short EAN for small products
            "code128",    // Used for various food products
            "code39",     // Sometimes used on food packaging
            "qr",         // QR codes
            "pdf417",     // PDF417
          ],
        }}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Barcode Outline Indicator */}
      {barcodeData?.bounds && (
        <View
          style={[
            styles.barcodeOutline,
            {
              left: barcodeData.bounds.origin.x,
              top: barcodeData.bounds.origin.y,
              width: barcodeData.bounds.size.width,
              height: barcodeData.bounds.size.height,
            },
          ]}
        />
      )}

      {/* Scanning Guide Overlay */}
      {!scanned && (
        <View style={styles.scanningGuide}>
          <View style={styles.scanFrame} />
          <Text style={styles.instructionText}>
            Point camera at barcode
          </Text>
        </View>
      )}

      {/* Scan Results */}
      {scanned && (
        <View style={styles.resultContainer}>
          <ScrollView style={styles.resultScrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.resultBox}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>Looking up product...</Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorTitle}>❌ {error}</Text>
                  <Text style={styles.resultType}>Barcode: {barcodeData?.data}</Text>
                  <Text style={styles.resultData}>Type: {barcodeData?.type}</Text>
                </View>
              ) : productInfo ? (
                <View style={styles.productContainer}>
                  <Text style={styles.productTitle}>
                    {productInfo.product_name || "Unknown Product"}
                  </Text>
                  
                  {productInfo.image_url && (
                    <Image 
                      source={{ uri: productInfo.image_url }} 
                      style={styles.productImage}
                      resizeMode="contain"
                    />
                  )}
                  
                  {productInfo.brands && (
                    <Text style={styles.productBrand}>Brand: {productInfo.brands}</Text>
                  )}
                  
                  {productInfo.quantity && (
                    <Text style={styles.productDetail}>Quantity: {productInfo.quantity}</Text>
                  )}
                  
                  {productInfo.categories && (
                    <Text style={styles.productDetail}>
                      Categories: {productInfo.categories.split(',').slice(0, 3).join(', ')}
                    </Text>
                  )}
                  
                  {productInfo.nutrition_grade && (
                    <Text style={styles.nutritionGrade}>
                      Nutrition Grade: {productInfo.nutrition_grade.toUpperCase()}
                    </Text>
                  )}
                  
                  <Text style={styles.barcodeInfo}>
                    Barcode: {barcodeData?.data} ({barcodeData?.type})
                  </Text>
                </View>
              ) : (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorTitle}>Product not found</Text>
                  <Text style={styles.resultData}>Barcode: {barcodeData?.data}</Text>
                </View>
              )}
              
              <Button title="Scan Again" onPress={resetScanner} />
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  barcodeOutline: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#00FF00',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  scanningGuide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resultContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
  },
  resultScrollView: {
    flex: 1,
  },
  resultBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 10,
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
    textAlign: 'center',
  },
  productContainer: {
    alignItems: 'center',
  },
  productTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  productImage: {
    width: 120,
    height: 120,
    marginBottom: 15,
    borderRadius: 8,
  },
  productBrand: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  productDetail: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    textAlign: 'center',
  },
  nutritionGrade: {
    fontSize: 14,
    color: '#34C759',
    marginBottom: 10,
    fontWeight: '600',
    backgroundColor: '#F0F9F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  barcodeInfo: {
    fontSize: 12,
    color: '#999',
    marginTop: 15,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  resultType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  resultData: {
    fontSize: 12,
    color: '#888',
    marginBottom: 15,
    textAlign: 'center',
  },
});