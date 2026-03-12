import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface User {
  email: string;
  avatar: string;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
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
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalClosable, setAuthModalClosable] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // 应用启动时恢复会话（Token 存在则自动登录）
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsInitializing(false);
      return;
    }
    fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setUser({
            email: data.email,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.email}`,
          });
          setPoints(data.totalPoints);
        } else {
          localStorage.removeItem('token');
        }
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setIsInitializing(false));
  }, []);

  const login = async (email: string, password: string, isRegister = false) => {
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '操作失败');

    localStorage.setItem('token', data.token);
    setUser({
      email: data.user.email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.email}`,
    });
    setPoints(data.user.totalPoints);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setPoints(0);
  };

  const deductPoints = async (amount: number): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('请先登录', 'error');
      return false;
    }
    const res = await fetch('/api/user/deduct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || '点数不足，请充值', 'error');
      return false;
    }
    setPoints(data.totalPoints);
    return true;
  };

  const openAuthModal = (closable = true) => {
    setAuthModalClosable(closable);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = (force = false) => {
    if (authModalClosable || force) {
      setIsAuthModalOpen(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
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
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
