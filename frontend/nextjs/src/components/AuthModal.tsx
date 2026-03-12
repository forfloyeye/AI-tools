"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2 } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalClosable, closeAuthModal, login, showToast } = useAppContext();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) newErrors.email = "邮箱不能为空";
    else if (!emailRegex.test(email)) newErrors.email = "请输入正确的邮箱格式";
    if (!password) newErrors.password = "密码不能为空";
    else if (tab === "register" && password.length < 6) newErrors.password = "密码至少需要6位";
    if (tab === "register" && password !== confirmPassword) newErrors.confirmPassword = "两次密码输入不一致";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await login(email, password, tab === "register");
      showToast(tab === "register" ? "注册成功，欢迎！" : "欢迎回来！", "success");
      setEmail(""); setPassword(""); setConfirmPassword(""); setErrors({});
      closeAuthModal(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败，请稍后重试";
      showToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={authModalClosable ? () => closeAuthModal() : undefined}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {authModalClosable && (
            <button
              onClick={() => closeAuthModal()}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              disabled={isLoading}
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <div className="flex border-b border-slate-100">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                className={cn(
                  "flex-1 py-4 text-sm font-medium transition-colors",
                  tab === t
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                )}
                onClick={() => { setTab(t); setErrors({}); }}
                disabled={isLoading}
              >
                {t === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <input
                type="text"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400",
                  errors.email
                    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    : "border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
                  isLoading && "bg-slate-50 opacity-70 cursor-not-allowed"
                )}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            <div>
              <input
                type="password"
                placeholder={tab === "register" ? "密码（至少6位）" : "密码"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400",
                  errors.password
                    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    : "border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
                  isLoading && "bg-slate-50 opacity-70 cursor-not-allowed"
                )}
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>

            {tab === "register" && (
              <div>
                <input
                  type="password"
                  placeholder="确认密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400",
                    errors.confirmPassword
                      ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
                    isLoading && "bg-slate-50 opacity-70 cursor-not-allowed"
                  )}
                />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
              </div>
            )}

            {tab === "login" && (
              <div className="flex justify-end">
                <a href="#" className="text-xs text-indigo-600 hover:text-indigo-700">忘记密码？</a>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {tab === "login" ? "登录" : "注册"}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
