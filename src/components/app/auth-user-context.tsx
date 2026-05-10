"use client";

import { createContext, useContext } from "react";
import type { AuthUser } from "@/lib/auth";

type AuthUserContextValue = {
  user: AuthUser | null;
};

const AuthUserContext = createContext<AuthUserContextValue>({
  user: null,
});

type AuthUserProviderProps = {
  user: AuthUser | null;
  children: React.ReactNode;
};

export function AuthUserProvider({ user, children }: AuthUserProviderProps) {
  return (
    <AuthUserContext.Provider value={{ user }}>{children}</AuthUserContext.Provider>
  );
}

export function useAuthUser() {
  return useContext(AuthUserContext);
}
