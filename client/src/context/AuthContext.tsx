import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as authApi from "../api/auth";
import { getAccessToken } from "../api/tokenStorage";
import type { LoginPayload, RegisterPayload, User } from "../types/auth";

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateDisplayName: (fullName: string) => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context and its provider are colocated deliberately
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => !!getAccessToken());

  useEffect(() => {
    if (!getAccessToken()) {
      return;
    }

    authApi
      .fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(payload: LoginPayload) {
    const loggedInUser = await authApi.login(payload);
    setUser(loggedInUser);
  }

  async function register(payload: RegisterPayload) {
    await authApi.register(payload);
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  async function updateDisplayName(fullName: string) {
    const updatedUser = await authApi.updateDisplayName(fullName);
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateDisplayName }}>
      {children}
    </AuthContext.Provider>
  );
}
