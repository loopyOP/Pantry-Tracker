import { Text, View, StyleSheet, Pressable } from "react-native";
import { useContext } from "react";
import { router } from "expo-router";
import { AuthContext } from "@/contexts/AuthContext";
import { useFonts, PassionOne_400Regular } from '@expo-google-fonts/passion-one';

export default function profile() {
  // Load the Passion One font
  const [fontsLoaded] = useFonts({
    PassionOne_400Regular,
  });

  const { token } = useContext(AuthContext);

  const handleLoginPress = () => {
    router.navigate("/login");
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
            <Text style={styles.subText}>Your data is syncing...</Text>
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
});