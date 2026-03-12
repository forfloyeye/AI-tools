"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getMe() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, freeCredits: true, paidCredits: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    freeCredits: user.freeCredits,
    paidCredits: user.paidCredits,
    totalPoints: user.freeCredits + user.paidCredits,
  };
}

export async function deductPoints(amount: number): Promise<{ totalPoints: number }> {
  const session = await getSession();
  if (!session) throw new Error("请先登录");

  if (!Number.isInteger(amount) || amount <= 0) throw new Error("无效的扣费金额");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { freeCredits: true, paidCredits: true },
  });
  if (!user) throw new Error("用户不存在");

  const total = user.freeCredits + user.paidCredits;
  if (total < amount) throw new Error("点数不足，请充值");

  let newFree = user.freeCredits;
  let newPaid = user.paidCredits;
  if (newFree >= amount) {
    newFree -= amount;
  } else {
    const remaining = amount - newFree;
    newFree = 0;
    newPaid -= remaining;
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { freeCredits: newFree, paidCredits: newPaid },
  });

  return { totalPoints: newFree + newPaid };
}
