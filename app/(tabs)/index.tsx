import { Text, View, StyleSheet, FlatList, Image, TouchableOpacity, Alert, Pressable, Modal, TextInput, TextInput as RNTextInput, Platform, ScrollView } from "react-native";
import { useState, useEffect, useContext, useRef } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useFonts, PassionOne_400Regular } from '@expo-google-fonts/passion-one';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import productService from "@/services/productService";
import { connectRealtime, disconnectRealtime, ProductsChangedPayload } from "@/services/realtimeService";

interface SavedProduct {
  id?: number; // Server ID (present after sync)
  product_name?: string;
  brands?: string;
  image_url?: string;
  barcode: string;
  scannedAt: string;
  calories?: string;
  expiration_date?: string;
  quantity?: number;
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

  const { token } = useContext(AuthContext);
  const { showSnackbar } = useSnackbar();
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SavedProduct | null>(null);
  const [alertDays, setAlertDays] = useState<string>('1');
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [tempQuantity, setTempQuantity] = useState<number>(1);
  const [tempQuantityText, setTempQuantityText] = useState<string>('1');
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'expiration'>('expiration');
  const [newExpirationDate, setNewExpirationDate] = useState<Date>(new Date());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedBarcodes, setSelectedBarcodes] = useState<Set<string>>(new Set());
  const [pendingQuantity, setPendingQuantity] = useState<Set<string>>(new Set());
  const lastQtyTapRef = useRef<Map<string, number>>(new Map());

  // Helper to convert local date to midnight UTC (preserves the date but stores as UTC)
  const toMidnightUTC = (date: Date): string => {
    // Create UTC date with same year/month/day as local date
    const utcDate = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0
    ));
    return utcDate.toISOString();
  };

  // Helper to format UTC date string without timezone conversion
  const formatUTCDate = (dateString: string): string => {
    const date = new Date(dateString);
    // Extract UTC components to avoid timezone shift
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    return `${month}/${day}/${year}`;
  };

  // Request notification permissions
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      showSnackbar('Please enable notifications to receive expiration alerts', { type: 'info' });
    }
  };

  // Selection helpers
  const toggleSelection = (barcode: string) => {
    setSelectedBarcodes(prev => {
      const next = new Set(prev);
      if (next.has(barcode)) next.delete(barcode); else next.add(barcode);
      return next;
    });
  };

  const startSelection = (barcode?: string) => {
    setSelectionMode(true);
    if (barcode) {
      setSelectedBarcodes(new Set([barcode]));
    }
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedBarcodes(new Set());
  };

  const selectAllVisible = () => {
    setSelectedBarcodes(new Set(filteredProducts.map(p => p.barcode)));
  };

  const deselectAll = () => {
    setSelectedBarcodes(new Set());
  };

  const restoreProducts = async (items: SavedProduct[]) => {
    if (!items || items.length === 0) return;
    const current = [...products];
    for (const item of items) {
      const idx = current.findIndex(p => p.barcode === item.barcode);
      if (idx !== -1) current[idx] = { ...current[idx], ...item }; else current.unshift(item);
    }
    setProducts(current);
    await AsyncStorage.setItem('scannedProducts', JSON.stringify(current));
    await scheduleAllNotifications(current);
    if (token) {
      try {
        await Promise.all(items.map(async (it) => {
          try { await productService.upsertProduct(it); } catch (e) { console.log('Restore upsert failed for', it.barcode, e); }
        }));
      } catch {}
    }
    showSnackbar('Restored item(s)', { type: 'success' });
  };

  const bulkDeleteSelected = async () => {
    const count = selectedBarcodes.size;
    if (count === 0) return;

    const selected = products.filter(p => selectedBarcodes.has(p.barcode));

    Alert.alert(
      'Delete Selected',
      `Are you sure you want to delete ${count} item${count !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (token) {
                await Promise.all(
                  selected.map(async (p) => {
                    try {
                      if (p.id) {
                        await productService.deleteProduct(p.id);
                      } else {
                        await productService.deleteProductByBarcode(p.barcode);
                      }
                    } catch (err) {
                      console.log('Server delete failed for', p.barcode, err);
                    }
                  })
                );
              }

              const updatedProducts = products.filter(p => !selectedBarcodes.has(p.barcode));
              setProducts(updatedProducts);
              await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
              await scheduleAllNotifications(updatedProducts);

              clearSelection();
              showSnackbar(`Removed ${count} item${count !== 1 ? 's' : ''} from your pantry`, { type: 'success', actionLabel: 'Undo', onAction: async () => {
                await restoreProducts(selected);
              }});
            } catch (error) {
              console.error('Bulk delete error:', error);
              showSnackbar('Failed to delete selected items. Please try again.', { type: 'error' });
            }
          }
        }
      ]
    );
  };

  const loadProducts = async () => {
    try {
      const savedProducts = await AsyncStorage.getItem('scannedProducts');
      if (savedProducts) {
        const parsedProducts = JSON.parse(savedProducts);
        // Set defaults and coerce types
        const productsWithDefaults = parsedProducts.map((p: SavedProduct) => {
          const isValidExp = p.expiration_date ? !isNaN(new Date(p.expiration_date).getTime()) : false;
          const qty = typeof (p as any).quantity === 'number' ? (p as any).quantity : parseInt((p as any).quantity as any ?? '1', 10);
          return {
            ...p,
            quantity: isNaN(qty) ? 1 : Math.max(0, qty),
            alertDaysBefore: isValidExp ? (p.alertDaysBefore ?? 1) : undefined,
          } as SavedProduct;
        });
        setProducts(productsWithDefaults);
        setFilteredProducts(productsWithDefaults);
        // Schedule notifications for all products
        scheduleAllNotifications(productsWithDefaults);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      showSnackbar('Failed to load products', { type: 'error' });
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
      // Also do a server merge if authenticated to pull latest
      (async () => {
        try {
          if (token) {
            const res = await productService.downloadAndMergeProducts();
            if (res?.merged) {
              setProducts(res.merged);
              setFilteredProducts(res.merged);
            }
          }
        } catch {}
      })();
    }, [])
  );

  const openProductOptions = (product: SavedProduct) => {
    setSelectedProduct(product);
    setOptionsModalVisible(true);
  };

  // Realtime subscription
  useEffect(() => {
    if (!token) {
      disconnectRealtime();
      return;
    }

    const handleChange = async (payload: ProductsChangedPayload) => {
      if (payload.type === 'upsert' && payload.product) {
        // Server sends camelCase; map to our local snake_case keys used in state
        const server = payload.product as any;
        const fieldMap: Record<string, string> = {
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
          'ingredientsText': 'ingredients_text',
          'barcode': 'barcode',
          'id': 'id',
        };
        const mapped: any = {};
        Object.entries(fieldMap).forEach(([from, to]) => {
          if (server[from] !== undefined && server[from] !== null) mapped[to] = server[from];
        });

        setProducts(prev => {
          const idx = prev.findIndex(p => p.barcode === mapped.barcode);
          let next: SavedProduct[];
          if (idx >= 0) {
            // Replace only fields indicated by changedFields to avoid clobbering local state
            const updated = { ...prev[idx] } as SavedProduct;
            const applyKeysArr: string[] = Array.isArray((payload as any).changedFields) ? (payload as any).changedFields : [];
            const applyKeys = new Set<string>(applyKeysArr);
            // Map changedFields camelCase to local keys
            const reverseMap: Record<string, string> = {};
            Object.entries(fieldMap).forEach(([from, to]) => { reverseMap[from] = to; });
            // If only quantity changed and server quantity equals local, skip merge but clear pending
            if (applyKeys.size === 1 && applyKeys.has('quantity')) {
              const serverQty = mapped['quantity'];
              const localQty = prev[idx].quantity ?? 1;
              if (typeof serverQty === 'number' && serverQty === localQty) {
                setPendingQuantity(prevSet => { const s = new Set(prevSet); s.delete(mapped.barcode); return s; });
                return prev;
              }
            }
            for (const k of applyKeys) {
              const localKey = reverseMap[k];
              if (localKey && mapped[localKey] !== undefined) {
                // Validate date fields to avoid invalid replacements
                if (localKey === 'expiration_date') {
                  const d = new Date(mapped[localKey]);
                  if (isNaN(d.getTime())) continue;
                }
                (updated as any)[localKey] = (mapped as any)[localKey];
              }
            }
            next = [...prev];
            next[idx] = updated;
          } else {
            next = [mapped as SavedProduct, ...prev];
          }
          (async () => {
            await AsyncStorage.setItem('scannedProducts', JSON.stringify(next));
          })();
          setFilteredProducts(next);
          // Clear pending lock if this was a quantity update for the same item
          if ((payload as any).changedFields?.includes?.('quantity')) {
            setPendingQuantity(prev => { const s = new Set(prev); s.delete(mapped.barcode); return s; });
          }
          return next;
        });
      } else if (payload.type === 'delete') {
        const targetBarcode = payload.barcode;
        if (!targetBarcode) return;
        setProducts(prev => {
          const next = prev.filter(p => p.barcode !== targetBarcode);
          (async () => {
            await AsyncStorage.setItem('scannedProducts', JSON.stringify(next));
          })();
          setFilteredProducts(next);
          return next;
        });
      }
    };

    const s = connectRealtime(token, handleChange);
    return () => {
      disconnectRealtime();
    };
  }, [token]);

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
            try {
              const deletedSnapshot: SavedProduct = { ...selectedProduct };
              // If logged in, delete from server first
              if (token) {
                if (selectedProduct.id) {
                  // Product has server ID, delete by ID
                  await productService.deleteProduct(selectedProduct.id);
                  console.log('Product deleted from server by ID');
                } else {
                  // Product doesn't have server ID, try deleting by barcode
                  try {
                    await productService.deleteProductByBarcode(selectedProduct.barcode);
                    console.log('Product deleted from server by barcode');
                  } catch (error) {
                    // Product might not exist on server yet, that's okay
                    console.log('Product not found on server, only deleting locally');
                  }
                }
              }
              
              // Delete from local storage
              const updatedProducts = products.filter(p => p.barcode !== selectedProduct.barcode);
              setProducts(updatedProducts);
              await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
              await scheduleAllNotifications(updatedProducts);
              
              showSnackbar('Product removed from your pantry', { type: 'success', actionLabel: 'Undo', onAction: async () => {
                await restoreProducts([deletedSnapshot]);
              }});
            } catch (error) {
              console.error('Error deleting product:', error);
              showSnackbar('Failed to delete product. Please try again.', { type: 'error' });
            }
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
    
    const updatedProduct = { ...selectedProduct, expiration_date: toMidnightUTC(newExpirationDate) };
    const updatedProducts = products.map(p =>
      p.barcode === selectedProduct.barcode
        ? updatedProduct
        : p
    );
    setProducts(updatedProducts);
    await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
    await scheduleAllNotifications(updatedProducts);
    showSnackbar('Expiration date updated', { type: 'success' });
    
    // If logged in, sync to server
    if (token) {
      try {
        await productService.upsertProduct(updatedProduct);
      } catch (error) {
        console.error('Error syncing expiration date update:', error);
      }
    }
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

  const openInfoModal = () => {
    if (!selectedProduct) return;
    setOptionsModalVisible(false);
    setInfoModalVisible(true);
  };

  const openQuantityModal = () => {
    if (!selectedProduct) return;
    setOptionsModalVisible(false);
    let qty = 1;
    if (typeof selectedProduct.quantity === 'number') {
      qty = selectedProduct.quantity;
    } else if (typeof (selectedProduct as any).quantity === 'string') {
      const parsed = parseInt((selectedProduct as any).quantity, 10);
      qty = isNaN(parsed) ? 1 : parsed;
    }
    setTempQuantity(Math.max(0, qty));
    setTempQuantityText(String(Math.max(0, qty)));
    setQuantityModalVisible(true);
  };

  const saveQuantityUpdate = async () => {
    if (!selectedProduct) return;
    const safeQty = Math.max(0, Math.floor(tempQuantity || 0));
    const updatedProduct: SavedProduct = { ...selectedProduct, quantity: safeQty };
    const updatedProducts = products.map(p =>
      p.barcode === selectedProduct.barcode ? updatedProduct : p
    );
    setProducts(updatedProducts);
    setSelectedProduct(updatedProduct);
    await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
    setQuantityModalVisible(false);
    showSnackbar('Quantity updated', { type: 'success' });

    if (token) {
      try {
        await productService.upsertProduct(updatedProduct);
      } catch (error) {
        console.error('Error syncing quantity update:', error);
      }
    }
  };

  const saveAlertSettings = async () => {
    if (!selectedProduct) return;

    const days = parseInt(alertDays);
    if (isNaN(days) || days < 0) {
      showSnackbar('Please enter a valid number of days', { type: 'error' });
      return;
    }

    const updatedProduct = { ...selectedProduct, alertDaysBefore: days };
    const updatedProducts = products.map(p => 
      p.barcode === selectedProduct.barcode 
        ? updatedProduct
        : p
    );

    setProducts(updatedProducts);
    await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
    await scheduleAllNotifications(updatedProducts);
    setAlertModalVisible(false);
    showSnackbar('Alert settings saved', { type: 'success' });
    
    // If logged in, sync to server
    if (token) {
      try {
        await productService.upsertProduct(updatedProduct);
      } catch (error) {
        console.error('Error syncing alert settings:', error);
      }
    }
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

  const isValidDateString = (value?: string): boolean => {
    if (!value) return false;
    const d = new Date(value);
    return !isNaN(d.getTime());
  };

  // Adjust quantity and persist/sync
  const adjustQuantity = async (barcode: string, delta: number) => {
    try {
      // Debounce fast repeat taps per item (200ms)
      const now = Date.now();
      const last = lastQtyTapRef.current.get(barcode) || 0;
      if (now - last < 200) return;
      lastQtyTapRef.current.set(barcode, now);

      // Prevent double handling while a server sync is in-flight
      if (pendingQuantity.has(barcode)) return;
      setPendingQuantity(prev => {
        const next = new Set(prev); next.add(barcode); return next;
      });
      const updated = products.map(p => {
        if (p.barcode !== barcode) return p;
        // Robustly coerce quantity from number or string
        let current = 1;
        if (typeof p.quantity === 'number') {
          current = p.quantity;
        } else if (typeof (p as any).quantity === 'string') {
          const parsed = parseInt((p as any).quantity, 10);
          current = isNaN(parsed) ? 1 : parsed;
        }
        const next = Math.max(0, current + delta);
        console.log('[qty] adjust', { barcode, current, delta, next });
        return { ...p, quantity: next } as SavedProduct;
      });
      setProducts(updated);
      setFilteredProducts(updated);
      await AsyncStorage.setItem('scannedProducts', JSON.stringify(updated));

      const changed = updated.find(p => p.barcode === barcode);
      if (token && changed) {
        try {
          if (changed.id) {
            // Send a minimal PATCH with only the changed fields
            await productService.updateProduct(changed.id, { quantity: changed.quantity });
          } else {
            // Upsert minimal payload so server only touches provided fields
            await productService.upsertProduct({ barcode: changed.barcode, quantity: changed.quantity });
          }
        } catch (err) {
          console.error('Error syncing quantity:', err);
        }
      }
    } catch (e) {
      console.error('Quantity adjust error:', e);
      showSnackbar('Failed to update quantity', { type: 'error' });
    } finally {
      setPendingQuantity(prev => { const next = new Set(prev); next.delete(barcode); return next; });
      // Fallback unlock in case of missed state transition
      setTimeout(() => {
        setPendingQuantity(prev => { const s = new Set(prev); s.delete(barcode); return s; });
      }, 3000);
    }
  };

  const renderProduct = ({ item }: { item: SavedProduct }) => {
    // Determine display name with fallback
    const displayName = item.product_name?.trim() 
      ? item.product_name 
      : item.brands?.trim() 
        ? `${item.brands}` 
        : 'Unknown Product';
    
    // Show warning if product name is missing
    const isMissingInfo = !item.product_name?.trim();

    const isSelected = selectedBarcodes.has(item.barcode);

    return (
      <View style={styles.productCard}>
        <TouchableOpacity 
          onPress={() => selectionMode ? toggleSelection(item.barcode) : openProductOptions(item)}
          onLongPress={() => !selectionMode ? startSelection(item.barcode) : toggleSelection(item.barcode)}
          activeOpacity={0.7}
        >
          <View style={styles.productRow}>
            {selectionMode && (
              <Pressable
                onPress={() => toggleSelection(item.barcode)}
                style={[styles.checkbox, isSelected && styles.checkboxSelected]}
              >
                {isSelected && <Text style={styles.checkboxTick}>✓</Text>}
              </Pressable>
            )}
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.productImage} />
            ) : (
              <View style={[styles.productImage, styles.placeholderImage]}>
                <Text style={styles.placeholderText}>📦</Text>
              </View>
            )}
            <View style={[styles.productInfo, { flexDirection: 'row', alignItems: 'center' }] }>
              <View style={{ flex: 1 }}>
              <Text style={styles.productName}>
                {displayName}
              </Text>
              {isMissingInfo && (
                <Text style={styles.warningText}>⚠️ Incomplete product data</Text>
              )}
              {item.brands && item.product_name?.trim() && (
                <Text style={styles.brandName}>{item.brands}</Text>
              )}
              {/* Calorie display removed as requested */}
              {item.expiration_date && isValidDateString(item.expiration_date) && (
                <>
                  <Text style={[styles.expirationText, { color: getExpirationColor(item.expiration_date) }]}>
                    📅 Expires: {formatUTCDate(item.expiration_date)}
                  </Text>
                  <Text style={styles.alertDaysText}>
                    🔔 Alert: {item.alertDaysBefore ?? 1} day{(item.alertDaysBefore ?? 1) !== 1 ? 's' : ''} before
                  </Text>
                </>
              )}
              <Text style={styles.scanDate}>
                Scanned: {formatUTCDate(item.scannedAt)}
              </Text>
              </View>

              {/* Quantity control */}
              <View
                style={styles.quantityControl}
                onStartShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
              >
                <Pressable style={[styles.qtyButton, styles.qtyPlus]} onPress={(e:any) => { e?.stopPropagation?.(); adjustQuantity(item.barcode, 1); }}>
                  <Text style={styles.qtyButtonText}>＋</Text>
                </Pressable>
                  <Text style={styles.qtyValue}>{(() => {
                    if (typeof item.quantity === 'number') return Math.max(0, item.quantity);
                    if (typeof (item as any).quantity === 'string') {
                      const parsed = parseInt((item as any).quantity, 10);
                      return isNaN(parsed) ? 1 : Math.max(0, parsed);
                    }
                    return 1;
                  })()}</Text>
                <Pressable style={[styles.qtyButton, styles.qtyMinus]} onPress={(e:any) => { e?.stopPropagation?.(); adjustQuantity(item.barcode, -1); }}>
                  <Text style={styles.qtyButtonText}>－</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

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

        {/* Selection Controls */}
        {!selectionMode ? (
          <View style={styles.selectionControls}>
            <Pressable style={styles.selectButton} onPress={() => startSelection()}>
              <Text style={styles.selectButtonText}>Select</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.selectionControlsRow}>
            <Pressable
              style={[styles.selectionActionButton, styles.selectAllButton]}
              onPress={() => {
                const allSelected = selectedBarcodes.size >= filteredProducts.length && filteredProducts.length > 0;
                allSelected ? deselectAll() : selectAllVisible();
              }}
            >
              <Text style={styles.selectionActionText}>
                {selectedBarcodes.size >= filteredProducts.length && filteredProducts.length > 0 ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
            <Pressable style={[styles.selectionActionButton, styles.cancelSelectButton]} onPress={clearSelection}>
              <Text style={styles.selectionActionText}>Cancel</Text>
            </Pressable>
            <Pressable 
              style={[styles.selectionActionButton, styles.deleteSelectButton]}
              onPress={() => bulkDeleteSelected()}
              disabled={selectedBarcodes.size === 0}
            >
              <Text style={styles.selectionActionText}>Delete ({selectedBarcodes.size})</Text>
            </Pressable>
          </View>
        )}
      </View>
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => `${item.barcode}::${item.expiration_date || 'none'}::${item.id || ''}`}
        contentContainerStyle={styles.listContainer}
      />
      <Text style={styles.hintText}>
        {selectionMode ? 'Tap items to select; then delete selected' : 'Tap on any item to see options'}
      </Text>

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
              style={styles.optionButton}
              onPress={openQuantityModal}
            >
              <Text style={styles.optionButtonText}>🔢 Edit Quantity</Text>
            </Pressable>

            <Pressable 
              style={styles.optionButton}
              onPress={openInfoModal}
            >
              <Text style={styles.optionButtonText}>ℹ️ Product Info</Text>
            </Pressable>

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
                    ? { ...p, expiration_date: toMidnightUTC(selectedDate) }
                    : p
                );
                setProducts(updatedProducts);
                await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
                await scheduleAllNotifications(updatedProducts);
                showSnackbar('Expiration date updated', { type: 'success' });
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

      {/* Quantity Modal */}
      <Modal
        visible={quantityModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setQuantityModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setQuantityModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Edit Quantity{selectedProduct?.product_name ? ` — ${selectedProduct.product_name}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
                <Pressable 
                  style={[styles.qtyButton, styles.qtyMinus]}
                  onPress={() => {
                    setTempQuantity(q => {
                      const next = Math.max(0, q - 1);
                      setTempQuantityText(String(next));
                      return next;
                    });
                  }}
                >
                  <Text style={styles.qtyButtonText}>－</Text>
                </Pressable>
                <TextInput
                  style={styles.qtyInput}
                  value={tempQuantityText}
                  onChangeText={(text) => {
                    // Keep only digits
                    const cleaned = text.replace(/[^0-9]/g, '');
                    setTempQuantityText(cleaned);
                    const parsed = cleaned === '' ? 0 : parseInt(cleaned, 10);
                    if (!isNaN(parsed)) {
                      setTempQuantity(Math.max(0, parsed));
                    }
                  }}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#999"
                />
                <Pressable 
                  style={[styles.qtyButton, styles.qtyPlus]}
                  onPress={() => {
                    setTempQuantity(q => {
                      const next = Math.max(0, q + 1);
                      setTempQuantityText(String(next));
                      return next;
                    });
                  }}
                >
                  <Text style={styles.qtyButtonText}>＋</Text>
                </Pressable>
              </View>
              <View style={styles.modalButtons}>
                <Pressable 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setQuantityModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
                <Pressable 
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveQuantityUpdate}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Product Info Modal */}
      <Modal
        visible={infoModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setInfoModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Product Info{selectedProduct?.product_name ? ` — ${selectedProduct.product_name}` : ''}
              </Text>
              <ScrollView style={{ maxHeight: 420 }}>
                {selectedProduct?.image_url ? (
                  <Image source={{ uri: selectedProduct.image_url }} style={styles.infoImage} />
                ) : null}
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Barcode:</Text><Text style={styles.infoValue}>{selectedProduct?.barcode || '—'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Name:</Text><Text style={styles.infoValue}>{selectedProduct?.product_name || '—'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Brand(s):</Text><Text style={styles.infoValue}>{selectedProduct?.brands || '—'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Quantity:</Text><Text style={styles.infoValue}>{(() => {
                  const q: any = selectedProduct?.quantity as any;
                  if (typeof q === 'number') return String(Math.max(0, q));
                  const parsed = parseInt(String(q ?? ''), 10);
                  return isNaN(parsed) ? '—' : String(Math.max(0, parsed));
                })()}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Nutrition Grade:</Text><Text style={styles.infoValue}>{selectedProduct?.nutrition_grade || '—'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Calories:</Text><Text style={styles.infoValue}>{selectedProduct?.calories ? String(selectedProduct.calories) : '—'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Categories:</Text><Text style={styles.infoValue}>{(selectedProduct as any)?.categories || '—'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Ingredients:</Text><Text style={styles.infoValue}>{(selectedProduct as any)?.ingredients_text || '—'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Expires:</Text><Text style={styles.infoValue}>{selectedProduct?.expiration_date ? formatUTCDate(selectedProduct.expiration_date) : '—'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Alert Days Before:</Text><Text style={styles.infoValue}>{selectedProduct?.alertDaysBefore ?? (selectedProduct?.expiration_date ? 1 : '—')}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Scanned:</Text><Text style={styles.infoValue}>{selectedProduct?.scannedAt ? formatUTCDate(selectedProduct.scannedAt) : '—'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Image URL:</Text><Text style={styles.infoValue}>{selectedProduct?.image_url || '—'}</Text></View>
              </ScrollView>
              <View style={styles.modalButtons}>
                <Pressable 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setInfoModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
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
  selectionControls: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  selectionControlsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'PassionOne_400Regular',
  },
  selectionActionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectAllButton: {
    backgroundColor: '#5856D6',
  },
  cancelSelectButton: {
    backgroundColor: '#999',
  },
  deleteSelectButton: {
    backgroundColor: '#FF3B30',
  },
  selectionActionText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'PassionOne_400Regular',
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#03A903',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 28,
  },
  checkboxSelected: {
    backgroundColor: '#03A903',
  },
  checkboxTick: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '700',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
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
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    marginBottom: 4,
    fontFamily: 'PassionOne_400Regular',
    fontStyle: 'italic',
  },
  calorieText: {
    fontSize: 13,
    color: '#FF6B35',
    marginBottom: 2,
    fontFamily: 'PassionOne_400Regular',
  },
  expirationText: {
    fontSize: 15,
    marginBottom: 2,
    fontFamily: 'PassionOne_400Regular',
    fontWeight: '600',
  },
  alertDaysText: {
    fontSize: 13,
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
  quantityControl: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 96,
    marginLeft: 8,
  },
  qtyButton: {
    width: 44,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyPlus: {
    backgroundColor: '#03A903',
  },
  qtyMinus: {
    backgroundColor: '#FF3B30',
  },
  qtyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  qtyInput: {
    width: 64,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    color: '#333',
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontFamily: 'PassionOne_400Regular',
    backgroundColor: '#fff',
  },
  infoImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
  },
  infoLabel: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'PassionOne_400Regular',
    minWidth: 120,
  },
  infoValue: {
    color: '#333',
    fontSize: 14,
    fontFamily: 'PassionOne_400Regular',
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
});
