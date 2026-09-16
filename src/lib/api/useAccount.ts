import { useQuery } from "@tanstack/react-query";
import { accountKeys, fetchAccount } from "./account";

export function useAccount() {
  return useQuery({
    queryKey: accountKeys.current,
    queryFn: fetchAccount,
    staleTime: 30_000,
    retry: 1,
  });
}
