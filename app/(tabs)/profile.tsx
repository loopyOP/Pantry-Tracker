import { Text, View, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import { useContext, useState } from "react";
import { router } from "expo-router";
import { AuthContext } from "@/contexts/AuthContext";
import { useFonts, PassionOne_400Regular } from '@expo-google-fonts/passion-one';
import productService from "@/services/productService";

export default function profile() {
  // Load the Passion One font
  const [fontsLoaded] = useFonts({
    PassionOne_400Regular,
  });

  const { token, logout } = useContext(AuthContext);
  const [syncing, setSyncing] = useState(false);

  const handleLoginPress = () => {
    router.navigate("/login");
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logout();
            Alert.alert('Logged Out', 'You have been logged out successfully.');
          }
        }
      ]
    );
  };

  const handleSyncData = async () => {
    setSyncing(true);
    try {
      const result = await productService.fullSync();
      
      Alert.alert(
        'Sync Complete! ✅',
        `Downloaded: ${result.downloaded} items\nUploaded: ${result.uploaded} items\nTotal in pantry: ${result.total} items`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert(
        'Sync Failed',
        'Unable to sync your data. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleClearServerData = () => {
    Alert.alert(
      'Clear Cloud Data',
      'This will delete all your products from the cloud. Your local products will remain. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cloud',
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.deleteAllProducts();
              Alert.alert(
                'Cloud Data Cleared ✅',
                'All products have been removed from the cloud. Your local products are still available.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Clear cloud data error:', error);
              Alert.alert('Error', 'Failed to clear cloud data. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading fonts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {token ? (
          <View style={styles.loggedInContainer}>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.subText}>Sync your pantry across all devices</Text>
            
            <Pressable 
              style={[styles.syncButton, syncing && styles.syncButtonDisabled]} 
              onPress={handleSyncData}
              disabled={syncing}
            >
              {syncing ? (
                <View style={styles.syncButtonContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.syncButtonText}>Syncing...</Text>
                </View>
              ) : (
                <Text style={styles.syncButtonText}>🔄 Sync Data</Text>
              )}
            </Pressable>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>How Sync Works:</Text>
              <Text style={styles.infoText}>• Downloads your products from the cloud</Text>
              <Text style={styles.infoText}>• Uploads any new local products</Text>
              <Text style={styles.infoText}>• Merges everything into your pantry</Text>
              <Text style={styles.infoText}>• Auto-saves new scans to the cloud</Text>
            </View>

            <Pressable 
              style={styles.clearButton} 
              onPress={handleClearServerData}
            >
              <Text style={styles.clearButtonText}>🗑️ Clear Cloud Data</Text>
            </Pressable>

            <Pressable 
              style={styles.logoutButton} 
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>🚪 Logout</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.loggedOutContainer}>
            <Text style={styles.titleText}>Login to Sync Data</Text>
            <Text style={styles.descriptionText}>
              Sign in to save your pantry items and access them across all your devices
            </Text>
            <Pressable style={styles.loginButton} onPress={handleLoginPress}>
              <Text style={styles.loginButtonText}>Go to Login</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loggedInContainer: {
    alignItems: 'center',
  },
  loggedOutContainer: {
    alignItems: 'center',
    maxWidth: 300,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '400',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '400',
    color: '#03A903',
    marginBottom: 8,
    fontFamily: 'PassionOne_400Regular',
  },
  subText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  descriptionText: {
    fontSize: 20,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
    fontFamily: 'PassionOne_400Regular',
  },
  loginButton: {
    backgroundColor: '#03A903',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  syncButton: {
    backgroundColor: '#03A903',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 200,
  },
  syncButtonDisabled: {
    backgroundColor: '#999',
  },
  syncButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  syncButtonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  infoBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxWidth: 320,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#333',
    marginBottom: 12,
    fontFamily: 'PassionOne_400Regular',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    fontFamily: 'PassionOne_400Regular',
    lineHeight: 20,
  },
  clearButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 200,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 200,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: 'PassionOne_400Regular',
  },
});