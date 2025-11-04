import { Text, View, StyleSheet, FlatList, Image, TouchableOpacity, Alert, Pressable, Modal, TextInput, TextInput as RNTextInput, Platform } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useFonts, PassionOne_400Regular } from '@expo-google-fonts/passion-one';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';

interface SavedProduct {
  product_name?: string;
  brands?: string;
  image_url?: string;
  barcode: string;
  scannedAt: string;
  calories?: string;
  expiration_date?: string;
  quantity?: string;
  nutrition_grade?: string;
  alertDaysBefore?: number; // Days before expiration to alert
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function Index() {
  // Load the Passion One font
  const [fontsLoaded] = useFonts({
    PassionOne_400Regular,
  });

  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SavedProduct | null>(null);
  const [alertDays, setAlertDays] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'expiration'>('expiration');
  const [newExpirationDate, setNewExpirationDate] = useState<Date>(new Date());

  // Request notification permissions
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please enable notifications to receive expiration alerts');
    }
  };

  const loadProducts = async () => {
    try {
      const savedProducts = await AsyncStorage.getItem('scannedProducts');
      if (savedProducts) {
        const parsedProducts = JSON.parse(savedProducts);
        // Set default alertDaysBefore if not present
        const productsWithDefaults = parsedProducts.map((p: SavedProduct) => ({
          ...p,
          alertDaysBefore: p.alertDaysBefore ?? 1,
        }));
        setProducts(productsWithDefaults);
        setFilteredProducts(productsWithDefaults);
        // Schedule notifications for all products
        scheduleAllNotifications(productsWithDefaults);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Normalize text for lenient search (remove accents, special characters, etc.)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9\s]/g, ''); // Remove special characters except spaces
  };

  // Filter and sort products
  useEffect(() => {
    let result = [...products];

    // Apply search filter
    if (searchQuery.trim()) {
      const normalizedQuery = normalizeText(searchQuery);
      result = result.filter(p => 
        normalizeText(p.product_name || '').includes(normalizedQuery) ||
        normalizeText(p.brands || '').includes(normalizedQuery) ||
        p.barcode.includes(searchQuery)
      );
    }

    // Apply sorting
    if (sortBy === 'name') {
      result.sort((a, b) => {
        const nameA = (a.product_name || 'Unknown').toLowerCase();
        const nameB = (b.product_name || 'Unknown').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === 'expiration') {
      result.sort((a, b) => {
        if (!a.expiration_date && !b.expiration_date) return 0;
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
      });
    }

    setFilteredProducts(result);
  }, [products, searchQuery, sortBy]);

  const scheduleAllNotifications = async (productsList: SavedProduct[]) => {
    // Cancel all existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Group products by alert dates and expiration dates
    const alertGroups = new Map<string, SavedProduct[]>();
    const expirationGroups = new Map<string, SavedProduct[]>();
    
    for (const product of productsList) {
      if (!product.expiration_date) continue;

      const expirationDate = new Date(product.expiration_date);
      expirationDate.setHours(9, 0, 0, 0);
      const daysBeforeAlert = product.alertDaysBefore ?? 1;
      
      // Add alert notification (X days before)
      if (daysBeforeAlert > 0) {
        const alertDate = new Date(expirationDate);
        alertDate.setDate(alertDate.getDate() - daysBeforeAlert);
        alertDate.setHours(9, 0, 0, 0); // Set to 9 AM
        const alertKey = alertDate.toDateString();
        
        if (!alertGroups.has(alertKey)) {
          alertGroups.set(alertKey, []);
        }
        alertGroups.get(alertKey)!.push(product);
      }
      
      // Add expiration day notification
      const expirationKey = expirationDate.toDateString();
      if (!expirationGroups.has(expirationKey)) {
        expirationGroups.set(expirationKey, []);
      }
      expirationGroups.get(expirationKey)!.push(product);
    }

    const now = new Date();

    // Schedule alert notifications
    for (const [dateKey, productsOnDate] of alertGroups.entries()) {
      const notificationDate = new Date(dateKey);
      notificationDate.setHours(9, 0, 0, 0);
      const timeDiff = notificationDate.getTime() - now.getTime();

      if (timeDiff > 0) {
        const count = productsOnDate.length;
        const firstProduct = productsOnDate[0];
        const daysUntil = firstProduct.alertDaysBefore ?? 1;
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: count === 1 ? '⚠️ Product Expiring Soon!' : `⚠️ ${count} Items Expiring Soon!`,
            body: count === 1 
              ? `${firstProduct.product_name || 'A product'} will expire in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}!`
              : `${productsOnDate.map(p => p.product_name || 'Unknown').join(', ')} expiring soon!`,
            data: { type: 'alert', barcodes: productsOnDate.map(p => p.barcode) },
          },
          trigger: { 
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.floor(timeDiff / 1000),
          },
        });
      }
    }

    // Schedule expiration day notifications
    for (const [dateKey, productsOnDate] of expirationGroups.entries()) {
      const notificationDate = new Date(dateKey);
      notificationDate.setHours(9, 0, 0, 0);
      const timeDiff = notificationDate.getTime() - now.getTime();

      if (timeDiff > 0) {
        const count = productsOnDate.length;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: count === 1 ? '🚨 Product Expiring Today!' : `🚨 ${count} Items Expiring Today!`,
            body: count === 1 
              ? `${productsOnDate[0].product_name || 'A product'} expires today!`
              : `${productsOnDate.map(p => p.product_name || 'Unknown').join(', ')}`,
            data: { type: 'expiration', barcodes: productsOnDate.map(p => p.barcode) },
          },
          trigger: { 
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.floor(timeDiff / 1000),
          },
        });
      }
    }
  };

  // Reload products when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const openProductOptions = (product: SavedProduct) => {
    setSelectedProduct(product);
    setOptionsModalVisible(true);
  };

  const deleteProduct = async () => {
    if (!selectedProduct) return;
    
    setOptionsModalVisible(false);
    
    Alert.alert(
      'Delete Product',
      'Are you sure you want to remove this item from your pantry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedProducts = products.filter(p => p.barcode !== selectedProduct.barcode);
            setProducts(updatedProducts);
            await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
            await scheduleAllNotifications(updatedProducts);
          },
        },
      ]
    );
  };

  const openExpirationDatePicker = () => {
    if (!selectedProduct) return;
    setOptionsModalVisible(false);
    
    if (Platform.OS === 'android') {
      // For Android, show native date picker immediately
      const currentDate = selectedProduct.expiration_date 
        ? new Date(selectedProduct.expiration_date)
        : new Date();
      setNewExpirationDate(currentDate);
      setDatePickerVisible(true);
    } else {
      // For iOS, show modal with date picker
      const currentDate = selectedProduct.expiration_date 
        ? new Date(selectedProduct.expiration_date)
        : new Date();
      setNewExpirationDate(currentDate);
      setDatePickerVisible(true);
    }
  };

  const saveExpirationDate = async (event: any, selectedDate?: Date) => {
    // For iOS, just update the date in the picker
    if (selectedDate) {
      setNewExpirationDate(selectedDate);
    }
  };

  const confirmExpirationDate = async () => {
    if (!selectedProduct) return;
    
    setDatePickerVisible(false);
    
    const updatedProducts = products.map(p =>
      p.barcode === selectedProduct.barcode
        ? { ...p, expiration_date: newExpirationDate.toISOString() }
        : p
    );
    setProducts(updatedProducts);
    await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
    await scheduleAllNotifications(updatedProducts);
  };

  const cancelExpirationDate = () => {
    setDatePickerVisible(false);
  };

  const openAlertModal = () => {
    if (!selectedProduct) return;
    setOptionsModalVisible(false);
    setAlertDays(String(selectedProduct.alertDaysBefore ?? 1));
    setAlertModalVisible(true);
  };

  const saveAlertSettings = async () => {
    if (!selectedProduct) return;

    const days = parseInt(alertDays);
    if (isNaN(days) || days < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of days');
      return;
    }

    const updatedProducts = products.map(p => 
      p.barcode === selectedProduct.barcode 
        ? { ...p, alertDaysBefore: days }
        : p
    );

    setProducts(updatedProducts);
    await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
    await scheduleAllNotifications(updatedProducts);
    setAlertModalVisible(false);
  };

  // Get expiration color based on days until expiration
  const getExpirationColor = (expirationDate: string): string => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expDate = new Date(expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil <= 0) return '#FF0000'; // Red - expired or expiring today
    if (daysUntil === 1) return '#FF4500'; // Dark orange - 1 day
    if (daysUntil === 2) return '#FF8C00'; // Orange - 2 days
    if (daysUntil === 3) return '#FFD700'; // Yellow/Gold - 3 days
    return '#5856D6'; // Purple - more than 3 days
  };

  const renderProduct = ({ item }: { item: SavedProduct }) => (
    <View style={styles.productCard}>
      <TouchableOpacity 
        onPress={() => openProductOptions(item)}
        activeOpacity={0.7}
      >
        <View style={styles.productRow}>
          {item.image_url && (
            <Image source={{ uri: item.image_url }} style={styles.productImage} />
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productName}>
              {item.product_name || 'Unknown Product'}
            </Text>
            {item.brands && (
              <Text style={styles.brandName}>{item.brands}</Text>
            )}
            {item.calories && (
              <Text style={styles.calorieText}>🔥 {parseFloat(item.calories).toFixed(2)} kcal/100g</Text>
            )}
            {item.expiration_date && (
              <>
                <Text style={[styles.expirationText, { color: getExpirationColor(item.expiration_date) }]}>
                  📅 Expires: {new Date(item.expiration_date).toLocaleDateString()}
                </Text>
                <Text style={styles.alertDaysText}>
                  🔔 Alert: {item.alertDaysBefore ?? 1} day{(item.alertDaysBefore ?? 1) !== 1 ? 's' : ''} before
                </Text>
              </>
            )}
            <Text style={styles.scanDate}>
              Scanned: {new Date(item.scannedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading your pantry...</Text>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>Your Pantry is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Go to the Scan tab to add items to your pantry
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Pantry</Text>
        <Text style={styles.headerSubtitle}>{products.length} items</Text>
        
        {/* Search Bar */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Sort Buttons */}
        <View style={styles.sortContainer}>
          <Pressable 
            style={[styles.sortButton, sortBy === 'expiration' && styles.sortButtonActive]}
            onPress={() => setSortBy('expiration')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'expiration' && styles.sortButtonTextActive]}>
              📅 By Date
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
            onPress={() => setSortBy('name')}
          >
            <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>
              🔤 A-Z
            </Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.barcode}
        contentContainerStyle={styles.listContainer}
      />
      <Text style={styles.hintText}>Tap on any item to see options</Text>

      {/* Product Options Modal */}
      <Modal
        visible={optionsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedProduct?.product_name || 'Product Options'}
            </Text>
            
            <Pressable 
              style={styles.optionButton}
              onPress={openExpirationDatePicker}
            >
              <Text style={styles.optionButtonText}>📅 Change Expiration Date</Text>
            </Pressable>

            {selectedProduct?.expiration_date && (
              <Pressable 
                style={styles.optionButton}
                onPress={openAlertModal}
              >
                <Text style={styles.optionButtonText}>🔔 Set Alert Days</Text>
              </Pressable>
            )}

            <Pressable 
              style={[styles.optionButton, styles.deleteOptionButton]}
              onPress={deleteProduct}
            >
              <Text style={[styles.optionButtonText, styles.deleteOptionText]}>🗑️ Delete Product</Text>
            </Pressable>

            <Pressable 
              style={[styles.optionButton, styles.cancelOptionButton]}
              onPress={() => setOptionsModalVisible(false)}
            >
              <Text style={styles.optionButtonText}>Cancel</Text>
            </Pressable>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date Picker Modal */}
      {datePickerVisible && (
        Platform.OS === 'ios' ? (
          <Modal
            visible={datePickerVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={cancelExpirationDate}
          >
            <TouchableOpacity 
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={cancelExpirationDate}
            >
              <TouchableOpacity 
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select Expiration Date</Text>
                  <View style={styles.datePickerContainer}>
                    <DateTimePicker
                      value={newExpirationDate}
                      mode="date"
                      display="spinner"
                      onChange={saveExpirationDate}
                      minimumDate={new Date()}
                      textColor="#000"
                      themeVariant="light"
                    />
                  </View>
                  <View style={styles.modalButtons}>
                    <Pressable 
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={cancelExpirationDate}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable 
                      style={[styles.modalButton, styles.saveButton]}
                      onPress={confirmExpirationDate}
                    >
                      <Text style={styles.modalButtonText}>Done</Text>
                    </Pressable>
                  </View>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        ) : (
          <DateTimePicker
            value={newExpirationDate}
            mode="date"
            display="default"
            onChange={async (event, selectedDate) => {
              setDatePickerVisible(false);
              if (selectedDate && selectedProduct) {
                const updatedProducts = products.map(p =>
                  p.barcode === selectedProduct.barcode
                    ? { ...p, expiration_date: selectedDate.toISOString() }
                    : p
                );
                setProducts(updatedProducts);
                await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
                await scheduleAllNotifications(updatedProducts);
              }
            }}
            minimumDate={new Date()}
          />
        )
      )}

      {/* Alert Settings Modal */}
      <Modal
        visible={alertModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAlertModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAlertModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Set Alert for {selectedProduct?.product_name}
            </Text>
            <Text style={styles.modalLabel}>
              Notify me how many days before expiration?
            </Text>
            <TextInput
              style={styles.modalInput}
              value={alertDays}
              onChangeText={setAlertDays}
              keyboardType="number-pad"
              placeholder="1"
            />
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAlertModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveAlertSettings}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </Pressable>
            </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    backgroundColor: '#03A903',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '400',
    color: '#fff',
    fontFamily: 'PassionOne_400Regular',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
    fontFamily: 'PassionOne_400Regular',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'PassionOne_400Regular',
  },
  sortContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  sortButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sortButtonActive: {
    backgroundColor: '#fff',
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  sortButtonTextActive: {
    color: '#03A903',
  },
  listContainer: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productRow: {
    flexDirection: 'row',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#333',
    marginBottom: 4,
    fontFamily: 'PassionOne_400Regular',
  },
  brandName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'PassionOne_400Regular',
  },
  calorieText: {
    fontSize: 13,
    color: '#FF6B35',
    marginBottom: 2,
    fontFamily: 'PassionOne_400Regular',
  },
  expirationText: {
    fontSize: 13,
    marginBottom: 2,
    fontFamily: 'PassionOne_400Regular',
    fontWeight: '600',
  },
  alertDaysText: {
    fontSize: 11,
    color: '#03A903',
    marginBottom: 2,
    fontFamily: 'PassionOne_400Regular',
  },
  scanDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '400',
    color: '#333',
    marginBottom: 8,
    fontFamily: 'PassionOne_400Regular',
  },
  emptySubtitle: {
    fontSize: 20,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  hintText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    paddingVertical: 10,
    fontFamily: 'PassionOne_400Regular',
  },
  optionButton: {
    backgroundColor: '#03A903',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'PassionOne_400Regular',
  },
  deleteOptionButton: {
    backgroundColor: '#FF3B30',
  },
  deleteOptionText: {
    color: '#fff',
  },
  cancelOptionButton: {
    backgroundColor: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '400',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  modalLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    fontFamily: 'PassionOne_400Regular',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#999',
  },
  saveButton: {
    backgroundColor: '#03A903',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'PassionOne_400Regular',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
});
