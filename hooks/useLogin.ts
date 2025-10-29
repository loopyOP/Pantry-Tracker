// hooks/useLogin.ts
import { useMutation } from "@tanstack/react-query";
import { submitLogin } from "@/services/loginService";
import * as SecureStore from "expo-secure-store";
import { useContext } from "react";
import { AuthContext } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";

export function useLogin() {
  const router = useRouter();
  const { setToken } = useContext(AuthContext);

  return useMutation({
    mutationKey: ["login"],
    mutationFn: submitLogin,
    onSuccess: async (data) => {
      await SecureStore.setItemAsync("auth_token", data.token);
      setToken(data.token);
      //Alert.alert("✅ Login Successful");
      router.replace("/(tabs)/profile");
    },
    onError: (error: any) => {
      //Alert.alert("❌ Login Failed", error.message);
    },
  });
}
