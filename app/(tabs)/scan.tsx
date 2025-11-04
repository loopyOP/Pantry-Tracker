import React, { useState, useEffect, useRef } from "react";
import { Text, View, StyleSheet, Button, ActivityIndicator, Image, ScrollView, Alert, Pressable, TextInput, Platform } from "react-native";
import { CameraView, Camera } from "expo-camera";
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFonts, PassionOne_400Regular } from '@expo-google-fonts/passion-one';

interface ProductInfo {
  product_name?: string;
  brands?: string;
  image_url?: string;
  categories?: string;
  ingredients_text?: string;
  nutrition_grade?: string;
  quantity?: string;
  expiration_date?: string;
  calories?: string;
  nutriments?: any;
}

export default function Scan() {
  // Load the Passion One font
  const [fontsLoaded] = useFonts({
    PassionOne_400Regular,
  });

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [barcodeData, setBarcodeData] = useState<any>(null);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manualExpirationDate, setManualExpirationDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };

    getCameraPermissions();
  }, []);

  // Function to save product to local storage
  const saveProductToStorage = async () => {
    if (!productInfo || !barcodeData) return;
    
    try {
      const existingProducts = await AsyncStorage.getItem('scannedProducts');
      const products = existingProducts ? JSON.parse(existingProducts) : [];
      
      // Use manual expiration date if set, otherwise use API data
      const finalExpirationDate = manualExpirationDate 
        ? manualExpirationDate.toISOString() 
        : productInfo.expiration_date;
      
      // Add scan timestamp and barcode to product
      const productWithMetadata = {
        ...productInfo,
        expiration_date: finalExpirationDate,
        barcode: barcodeData.data,
        scannedAt: new Date().toISOString(),
      };
      
      // Check if product already exists, update it instead of adding duplicate
      const existingIndex = products.findIndex((p: any) => p.barcode === barcodeData.data);
      if (existingIndex !== -1) {
        products[existingIndex] = productWithMetadata;
      } else {
        products.unshift(productWithMetadata); // Add to beginning of array
      }
      
      await AsyncStorage.setItem('scannedProducts', JSON.stringify(products));
      Alert.alert('Success', 'Product saved to your pantry!');
      resetScanner();
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Error', 'Failed to save product to storage');
    }
  };

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
          expiration_date: data.product.expiration_date,
          calories: data.product.nutriments?.["energy-kcal_100g"] || data.product.nutriments?.["energy-kcal"],
          nutriments: data.product.nutriments,
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
      // Note: Product is NOT automatically saved - user must confirm
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
    setManualExpirationDate(undefined);
    setShowDatePicker(false);
  };

  // Handle date picker change
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS
    if (selectedDate) {
      setManualExpirationDate(selectedDate);
    }
  };

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

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
                  
                  {productInfo.calories && (
                    <Text style={styles.calorieInfo}>
                      🔥 Calories: {parseFloat(productInfo.calories).toFixed(2)} kcal per 100g
                    </Text>
                  )}
                  
                  {(productInfo.expiration_date || manualExpirationDate) && (
                    <Text style={styles.expirationInfo}>
                      📅 Expires: {manualExpirationDate 
                        ? manualExpirationDate.toLocaleDateString()
                        : new Date(productInfo.expiration_date!).toLocaleDateString()}
                    </Text>
                  )}
                  
                  {!productInfo.expiration_date && !manualExpirationDate && (
                    <View style={styles.addExpirationContainer}>
                      <Text style={styles.noExpirationText}>No expiration date found</Text>
                      <Pressable 
                        style={styles.addExpirationButton}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text style={styles.addExpirationButtonText}>+ Add Expiration Date</Text>
                      </Pressable>
                    </View>
                  )}
                  
                  {(productInfo.expiration_date || manualExpirationDate) && (
                    <Pressable 
                      style={styles.changeExpirationButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={styles.changeExpirationButtonText}>Change Date</Text>
                    </Pressable>
                  )}
                  
                  {showDatePicker && (
                    <DateTimePicker
                      value={manualExpirationDate || new Date()}
                      mode="date"
                      display="default"
                      onChange={onDateChange}
                      minimumDate={new Date()}
                    />
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
                  
                  <View style={styles.actionButtons}>
                    <Pressable 
                      style={styles.saveButton}
                      onPress={saveProductToStorage}
                    >
                      <Text style={styles.saveButtonText}>✓ Add to Pantry</Text>
                    </Pressable>
                    <Pressable 
                      style={styles.cancelButton}
                      onPress={resetScanner}
                    >
                      <Text style={styles.cancelButtonText}>✕ Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorTitle}>Product not found</Text>
                  <Text style={styles.resultData}>Barcode: {barcodeData?.data}</Text>
                  <Pressable 
                    style={styles.cancelButton}
                    onPress={resetScanner}
                  >
                    <Text style={styles.cancelButtonText}>Scan Again</Text>
                  </Pressable>
                </View>
              )}
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
    fontWeight: '400',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    fontFamily: 'PassionOne_400Regular',
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
    fontWeight: '400',
    fontFamily: 'PassionOne_400Regular',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#FF3B30',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  productContainer: {
    alignItems: 'center',
  },
  productTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
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
    fontWeight: '400',
    fontFamily: 'PassionOne_400Regular',
  },
  productDetail: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  nutritionGrade: {
    fontSize: 14,
    color: '#34C759',
    marginBottom: 10,
    fontWeight: '400',
    backgroundColor: '#F0F9F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontFamily: 'PassionOne_400Regular',
  },
  calorieInfo: {
    fontSize: 15,
    color: '#FF6B35',
    marginBottom: 8,
    fontWeight: '400',
    backgroundColor: '#FFF5F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  expirationInfo: {
    fontSize: 15,
    color: '#5856D6',
    marginBottom: 8,
    fontWeight: '400',
    backgroundColor: '#F3F3FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
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
    fontWeight: '400',
    color: '#333',
    marginBottom: 10,
    fontFamily: 'PassionOne_400Regular',
  },
  resultType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontFamily: 'PassionOne_400Regular',
  },
  resultData: {
    fontSize: 12,
    color: '#888',
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  addExpirationContainer: {
    marginVertical: 10,
    padding: 12,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    borderStyle: 'dashed',
  },
  noExpirationText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'PassionOne_400Regular',
  },
  addExpirationButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  addExpirationButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'PassionOne_400Regular',
  },
  changeExpirationButton: {
    backgroundColor: '#E8E8E8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'center',
    marginVertical: 8,
  },
  changeExpirationButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'PassionOne_400Regular',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#03A903',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'PassionOne_400Regular',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'PassionOne_400Regular',
  },
});