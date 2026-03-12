"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { signToken, TOKEN_COOKIE } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(email: string, password: string) {
  if (!email || !password) throw new Error("邮箱和密码不能为空");
  if (!EMAIL_REGEX.test(email)) throw new Error("请输入正确的邮箱格式");
  if (password.length < 6) throw new Error("密码至少需要6位");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("该邮箱已注册，请直接登录");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, freeCredits: 300, paidCredits: 0 },
  });

  const token = await signToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return {
    id: user.id,
    email: user.email,
    freeCredits: user.freeCredits,
    paidCredits: user.paidCredits,
    totalPoints: user.freeCredits + user.paidCredits,
  };
}

export async function login(email: string, password: string) {
  if (!email || !password) throw new Error("邮箱和密码不能为空");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("邮箱或密码错误");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("邮箱或密码错误");

  // 每日免费积分重置
  const today = new Date().toISOString().slice(0, 10);
  let freeCredits = user.freeCredits;
  if (user.lastLoginDate !== today) {
    await prisma.user.update({
      where: { id: user.id },
      data: { freeCredits: 300, lastLoginDate: today },
    });
    freeCredits = 300;
  }

  const token = await signToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return {
    id: user.id,
    email: user.email,
    freeCredits,
    paidCredits: user.paidCredits,
    totalPoints: freeCredits + user.paidCredits,
  };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
}
