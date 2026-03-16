<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3b09fc7d-eb62-43b7-b2a4-ba1e85d674e6

## Run Locally

**Prerequisites:** Node.js

### 安装依赖

```bash
cd frontend/ai-tools
npm install
```

### 配置环境变量

在 `frontend/ai-tools/` 目录下创建 `.env.local`，填入：

```
GEMINI_API_KEY=your_gemini_api_key
REMOVE_BG_API_KEY=your_remove_bg_api_key
```

### 启动后端服务（Express API，端口 3001）

```bash
cd /Users/macmini/Coding/AI-tools/frontend/ai-tools && npm run server:watch
```

### 启动前端服务（Vite，端口 3000）

```bash
cd /Users/macmini/Coding/AI-tools/frontend/ai-tools && npm run dev
```

> 两个服务需同时运行。前端通过 Vite 代理将 `/api` 请求转发到后端 `localhost:3001`。
> 若 `3000` 被占用，前端会直接报错（不会自动切端口），以避免与后端 `3001` 端口冲突导致代理异常。

### 可选：自定义 API 代理地址

在 `frontend/ai-tools/.env.local` 里增加：

```
VITE_API_TARGET=http://127.0.0.1:3001
```
