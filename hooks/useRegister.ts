import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { submitRegister } from "@/services/registerService";

export function useRegister() {
  const router = useRouter();
    return useMutation({
      mutationFn: submitRegister,
      onSuccess: (data) => {
        // Handle successful registration
      },
      onError: (error) => {
        // Handle registration error
      },
    });
  }