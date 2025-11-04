import { Text, View, StyleSheet, FlatList, Image, TouchableOpacity, Alert } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useFonts, PassionOne_400Regular } from '@expo-google-fonts/passion-one';

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
}

export default function Index() {
  // Load the Passion One font
  const [fontsLoaded] = useFonts({
    PassionOne_400Regular,
  });

  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    try {
      const savedProducts = await AsyncStorage.getItem('scannedProducts');
      if (savedProducts) {
        setProducts(JSON.parse(savedProducts));
      }
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Reload products when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const deleteProduct = async (barcode: string) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to remove this item from your pantry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedProducts = products.filter(p => p.barcode !== barcode);
            setProducts(updatedProducts);
            await AsyncStorage.setItem('scannedProducts', JSON.stringify(updatedProducts));
          },
        },
      ]
    );
  };

  const renderProduct = ({ item }: { item: SavedProduct }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onLongPress={() => deleteProduct(item.barcode)}
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
            <Text style={styles.calorieText}>🔥 {item.calories} kcal/100g</Text>
          )}
          {item.expiration_date && (
            <Text style={styles.expirationText}>
              📅 Expires: {new Date(item.expiration_date).toLocaleDateString()}
            </Text>
          )}
          <Text style={styles.scanDate}>
            Scanned: {new Date(item.scannedAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
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
      </View>
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.barcode}
        contentContainerStyle={styles.listContainer}
      />
      <Text style={styles.hintText}>Long press to delete items</Text>
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
    color: '#5856D6',
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
});
