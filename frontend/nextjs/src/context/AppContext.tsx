"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { login as loginAction, register as registerAction, logout as logoutAction } from "@/actions/auth";
import { getMe, deductPoints as deductAction } from "@/actions/user";

interface User {
  email: string;
  avatar: string;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface AppContextType {
  user: User | null;
  points: number;
  isAuthModalOpen: boolean;
  authModalClosable: boolean;
  toast: Toast | null;
  isInitializing: boolean;
  login: (email: string, password: string, isRegister?: boolean) => Promise<void>;
  logout: () => void;
  deductPoints: (amount: number) => Promise<boolean>;
  openAuthModal: (closable?: boolean) => void;
  closeAuthModal: (force?: boolean) => void;
  showToast: (message: string, type?: "success" | "error") => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalClosable, setAuthModalClosable] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    getMe()
      .then((data) => {
        if (data) {
          setUser({
            email: data.email,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.email}`,
          });
          setPoints(data.totalPoints);
        }
      })
      .catch(() => {})
      .finally(() => setIsInitializing(false));
  }, []);

  const login = async (email: string, password: string, isRegister = false) => {
    const data = isRegister
      ? await registerAction(email, password)
      : await loginAction(email, password);
    setUser({
      email: data.email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.email}`,
    });
    setPoints(data.totalPoints);
  };

  const logout = async () => {
    await logoutAction();
    setUser(null);
    setPoints(0);
  };

  const deductPoints = async (amount: number): Promise<boolean> => {
    try {
      const data = await deductAction(amount);
      setPoints(data.totalPoints);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "点数不足，请充值";
      showToast(msg, "error");
      return false;
    }
  };

  const openAuthModal = (closable = true) => {
    setAuthModalClosable(closable);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = (force = false) => {
    if (authModalClosable || force) setIsAuthModalOpen(false);
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        points,
        isAuthModalOpen,
        authModalClosable,
        toast,
        isInitializing,
        login,
        logout,
        deductPoints,
        openAuthModal,
        closeAuthModal,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
};
