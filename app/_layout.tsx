import { Query, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { Stack } from "expo-router";
import { Slot } from "expo-router";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen 
            name="login" 
            options={{ 
              presentation: 'modal',
              title: 'Login' 
            }} 
          />
          <Stack.Screen 
            name="register" 
            options={{ 
              presentation: 'modal',
              title: 'Register' 
            }} 
          />
        </Stack>
      </QueryClientProvider>
    </AuthProvider>
  );
}