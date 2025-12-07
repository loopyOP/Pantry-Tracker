// contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { View, ActivityIndicator, Text } from "react-native";

type AuthContextType = {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  logout: () => {},
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync("auth_token");
        if (saved) setToken(saved);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const logout = async () => {
    await SecureStore.deleteItemAsync("auth_token");
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, setToken, logout, loading }}>
      {children}
      {loading && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.6)",
          }}
        >
          <ActivityIndicator size="large" />
          <Text>Checking authentication…</Text>
        </View>
      )}
    </AuthContext.Provider>
  );
};
