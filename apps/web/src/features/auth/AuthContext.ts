import { createContext } from "react";
import type { User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  holdPublicRedirect: boolean;
  setHoldPublicRedirect: (hold: boolean) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
