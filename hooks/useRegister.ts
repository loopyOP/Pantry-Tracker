import { useMutation } from "@tanstack/react-query";
import { submitRegister } from "@/services/registerService";

type RegisterValues = { username: string; email: string; password: string };

export function useRegister(onSuccess?: (data: any, variables: RegisterValues) => void, onError?: (error: any) => void) {
  return useMutation({
    mutationKey: ["register"],
    mutationFn: submitRegister,
    onSuccess: (data, variables) => {
      if (onSuccess) onSuccess(data, variables);
    },
    onError: (error) => {
      if (onError) onError(error);
    },
  });
}