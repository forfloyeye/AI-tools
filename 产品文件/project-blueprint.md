### 📋 以下是提供给 Claude Code 的 Blueprint Markdown 文件内容：

````markdown
# 🚀 Next.js Vercel Full-Stack Project Blueprint

## 🎯 目标 (Project Goal)

构建一个现代化的全栈 Web 应用，要求前后端同仓，使用 Serverless 架构，目标是实现 Vercel 的**零配置一键部署**。

## 🛠 技术栈 (Tech Stack)

你必须严格使用以下技术栈，**严禁引入其他不相关的替代库**：

- **框架**: Next.js (必须使用 **App Router**，绝对不要使用 Pages Router)
- **数据库**: Vercel Postgres
- **ORM**: Prisma (与 Vercel Postgres 原生配合最佳)
- **样式**: Tailwind CSS
- **UI 组件库**: shadcn/ui
- **开发语言**: TypeScript
- **包管理器**: npm

## 📜 架构与代码规范 (Architecture & Coding Rules)

1. **彻底放弃传统 API 路由**: 除非必须对外提供公开 API 接口，否则**严禁**在 `app/api/` 下编写后端接口。
2. **使用 Server Actions**: 所有的表单提交、数据库增删改查逻辑，必须写在 `src/actions/` 目录下，并在文件顶部声明 `'use server'`。
3. **服务端组件优先**: 页面 (`page.tsx`) 默认作为 Server Components，直接导入 Prisma Client 并查询数据库。只在需要交互的组件（如表单、按钮）上使用 `'use client'` 并将其抽离到 `components/` 目录。
4. **单例模式防爆库**: 必须在 `src/lib/prisma.ts` 中使用 global 单例模式初始化 Prisma Client，防止开发环境下热更新导致数据库连接数耗尽。

---

## 🪜 执行步骤 (Execution Steps for AI Agent)

作为 AI Agent，请按照以下顺序**自动执行命令并创建/修改文件**。在每一步完成后，再进行下一步。

### Step 1: 初始化基础环境

运行以下命令初始化 Next.js 项目并安装核心依赖（请静默执行，处理依赖冲突）：

```bash
# 如果当前目录不是空项目，请忽略 init，直接安装依赖
npm install prisma @prisma/client
npx prisma init
```
````

### Step 2: 配置 Prisma (核心数据库映射)

1. 修改 `prisma/schema.prisma` 文件，内容如下：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_PRISMA_URL") // Vercel Postgres 默认环境变量
  directUrl = env("POSTGRES_URL_NON_POOLING")
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
}
```

### Step 3: 创建核心目录与文件 (写入代码)

请在项目中创建/覆盖以下核心文件：

**1. 创建 `src/lib/prisma.ts` (单例 Prisma Client):**

```typescript
import { PrismaClient } from "@prisma/client"

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma
```

**2. 创建 `src/actions/user.ts` (Server Action 后端逻辑):**

```typescript
"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createUser(formData: FormData) {
  const name = formData.get("name") as string
  const email = formData.get("email") as string

  if (!name || !email) throw new Error("Missing fields")

  await prisma.user.create({
    data: { name, email },
  })

  // 刷新当前路由缓存，实现数据即时更新
  revalidatePath("/")
}
```

**3. 覆盖 `src/app/page.tsx` (全栈页面):**

```tsx
import prisma from "@/lib/prisma"
import { createUser } from "@/actions/user"

export default async function HomePage() {
  // 服务端直接查询数据库
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  })

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Vercel 全栈一键部署模板</h1>

      <div className="bg-white shadow rounded-lg p-6 mb-8 border">
        <h2 className="text-xl font-semibold mb-4">添加新用户</h2>
        {/* Server Action 直接绑定到 form action */}
        <form action={createUser} className="flex gap-4">
          <input
            name="name"
            placeholder="姓名"
            className="flex-1 border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-black"
            required
          />
          <input
            name="email"
            type="email"
            placeholder="邮箱"
            className="flex-1 border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-black"
            required
          />
          <button
            type="submit"
            className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800 transition-colors"
          >
            提交
          </button>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg p-6 border">
        <h2 className="text-xl font-semibold mb-4">用户列表 ({users.length})</h2>
        <ul className="divide-y">
          {users.map((user) => (
            <li key={user.id} className="py-3 flex justify-between items-center">
              <span className="font-medium">{user.name}</span>
              <span className="text-gray-500 text-sm">{user.email}</span>
            </li>
          ))}
          {users.length === 0 && <p className="text-gray-400 text-center py-4">暂无数据</p>}
        </ul>
      </div>
    </main>
  )
}
```

### Step 4: 配置 Vercel 自动化部署脚本

修改根目录的 `package.json`，在 `scripts` 字段中确保包含以下指令（这对于 Vercel 自动执行数据库同步至关重要）：

```json
"scripts": {
  "dev": "next dev",
  "build": "prisma generate && prisma db push && next build",
  "start": "next start",
  "lint": "next lint",
  "postinstall": "prisma generate"
}
```

### Step 5: 完成提示

向人类开发者输出以下下一步手动操作指南：

1. 请先在本地创建 `.env` 文件，配置本地 PostgreSQL 数据库测试（或直接进入 Vercel 配置）。
2. 将代码推送到 GitHub。
3. 在 Vercel 控制台导入项目。
4. 在 Vercel 的 Storage 面板创建一个 Postgres 数据库并关联到该项目。
5. 点击 Deploy，等待魔法发生！

```

---

### 💡 为什么这个 Prompt 对 Claude 极其有效？

1. **设定了边界**：AI 最容易犯的错就是用旧办法解决新问题。文档里明确指出了**“绝对不要使用 Pages Router”**和**“严禁使用 /api 目录”**，这会迫使 Claude 采用 Next.js 14+ 最先进的 Server Actions 写法。
2. **解决了 Prisma 部署的致命坑**：里面让 AI 修改 `package.json` 的 `build` 命令为 `"prisma generate && prisma db push && next build"`。如果不这样配置，Vercel 部署时常常会报 `PrismaClient not found` 的错误，这一行替你省了几个小时的排错时间。
3. **单例模式**：强制 AI 使用 `globalThis.prismaGlobal` 单例模式，否则本地开发时你保存几次文件，数据库连接池就会被撑爆报错。

你只需要把上面的 markdown 喂给 Claude Code，喝口水的功夫，一个完美符合 Vercel 部署标准的全栈脚手架就会立刻生成好，完全不用手写一行代码。
```
