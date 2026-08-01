import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./AuthContext";

/** AuthProvider가 제공하는 인증 상태(Context)를 소비하는 훅. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
}
