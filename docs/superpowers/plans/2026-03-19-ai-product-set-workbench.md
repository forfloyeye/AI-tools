# AI商品套图工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立的“AI商品套图”工作台，面向服饰类商品，支持商品上传、基础模特生成与选择、场景模板批量生成、结果管理与历史记录查看，且不复用现有 `AiScene.tsx` 作为主页面。

**Architecture:** 前端新增独立页面 `/tools/ai-product-set`，以工作台状态机组织“上传商品 -> 生成基础模特 -> 选择模特 -> 选择场景与姿势 -> 批量生成 -> 结果管理”。后端新增独立 `/api/ai-product-set` 路由，基础模特生成先走同步返回，批量套图生成在单次请求内完成并持久化批次记录与结果图，以 SQLite 支撑 MVP 的历史记录能力。现有 `ai-scene` 仅保留原工具职责，不承担新模块入口或主状态。

**Tech Stack:** React 19、React Router、TypeScript、Tailwind、Express、better-sqlite3、`@google/genai`、现有鉴权与积分体系。

---

### Task 1: 接入独立工具入口与页面骨架

**Files:**
- Create: `frontend/ai-tools/src/pages/AiProductSet.tsx`
- Create: `frontend/ai-tools/src/utils/aiProductSetService.ts`
- Modify: `frontend/ai-tools/src/components/AnimatedRoutes.tsx`
- Modify: `frontend/ai-tools/src/pages/Dashboard.tsx`

- [ ] **Step 1: 先写前端路由接入前的类型草图**

```ts
export type ProductReferenceImage = {
  id: string;
  file: File;
  previewUrl: string;
  angleLabel: string;
};

export type ModelAttributeForm = {
  gender: 'female' | 'male' | 'neutral';
  ageGroup: 'teen' | 'young-adult' | 'adult' | 'mature';
  ethnicity: string;
  bodyType: string;
  appearanceNotes: string;
};
```

- [ ] **Step 2: 新建独立页面骨架**

在 `frontend/ai-tools/src/pages/AiProductSet.tsx` 创建工作台页面，先只放页头、步骤导航容器、左右布局占位，不接入旧的 `AiScene` 组件或其 JSX。

- [ ] **Step 3: 注册独立路由**

修改 `frontend/ai-tools/src/components/AnimatedRoutes.tsx`，新增：

```tsx
<Route path="/tools/ai-product-set" element={<PageWrapper><AiProductSet /></PageWrapper>} />
```

- [ ] **Step 4: 接通 Dashboard 卡片入口**

修改 `frontend/ai-tools/src/pages/Dashboard.tsx`，将 `ai-set` 的 `path` 从 `'#'` 改为 `'/tools/ai-product-set'`，文案保持“AI商品套图”。

- [ ] **Step 5: 运行类型检查**

Run: `npm run lint`
Expected: `AnimatedRoutes`、`Dashboard`、`AiProductSet` 无 TS 错误。

### Task 2: 为批量套图建立独立后端路由与持久化表

**Files:**
- Create: `frontend/ai-tools/server/routes/ai-product-set.ts`
- Create: `frontend/ai-tools/server/tests/ai-product-set.integration.test.ts`
- Modify: `frontend/ai-tools/server/app.ts`
- Modify: `frontend/ai-tools/server/db.ts`
- Modify: `frontend/ai-tools/package.json`

- [ ] **Step 1: 先写集成测试，约束 API 骨架**

新增 `frontend/ai-tools/server/tests/ai-product-set.integration.test.ts`，先覆盖：
- 未登录访问 `POST /api/ai-product-set/base-models/generate` 返回 `401`
- 未登录访问 `POST /api/ai-product-set/batches/generate` 返回 `401`
- `GET /api/ai-product-set/history` 在已登录时返回 `200` + 空数组

- [ ] **Step 2: 扩展 SQLite 表结构**

在 `frontend/ai-tools/server/db.ts` 新增：

```sql
CREATE TABLE IF NOT EXISTS ai_product_set_batches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_payload_json TEXT NOT NULL,
  model_config_json TEXT NOT NULL,
  selected_model_image TEXT NOT NULL,
  scene_selections_json TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  total_cost INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_product_set_results (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES ai_product_set_batches(id) ON DELETE CASCADE,
  scene_code TEXT NOT NULL,
  framing TEXT NOT NULL,
  facing TEXT NOT NULL,
  image_data TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

- [ ] **Step 3: 搭建路由骨架**

在 `frontend/ai-tools/server/routes/ai-product-set.ts` 新增以下接口：
- `POST /base-models/generate`
- `POST /batches/generate`
- `GET /history`
- `GET /history/:batchId`

- [ ] **Step 4: 挂载路由与测试脚本**

修改：
- `frontend/ai-tools/server/app.ts` 挂载 `app.use('/api/ai-product-set', aiProductSetRoutes);`
- `frontend/ai-tools/package.json` 增加 `"test:ai-product-set": "tsx server/tests/ai-product-set.integration.test.ts"`

- [ ] **Step 5: 运行路由骨架测试**

Run: `npm run test:ai-product-set`
Expected: 未登录鉴权与空历史列表通过。

### Task 3: 实现工作台本地状态与商品上传步骤

**Files:**
- Modify: `frontend/ai-tools/src/pages/AiProductSet.tsx`
- Modify: `frontend/ai-tools/src/utils/aiProductSetService.ts`

- [ ] **Step 1: 定义工作台状态模型**

在 `AiProductSet.tsx` 中定义：

```ts
type WorkbenchStep = 'upload' | 'base-model' | 'model-pick' | 'scene-config' | 'batch-result' | 'history';

type SceneTemplateSelection = {
  templateId: string;
  framing: 'full' | 'half' | 'three-quarter' | 'close-up';
  facing: 'front' | 'side' | 'three-quarter-side' | 'back';
};
```

- [ ] **Step 2: 实现商品上传区**

支持：
- 单件/多件/不同角度图上传
- 每张图可编辑角度标签
- 图片类型与大小校验
- 预览与删除

最小 UI 要求：
- 上传列表
- 拖拽上传
- “至少 1 张商品图”校验提示

- [ ] **Step 3: 抽出前端服务请求基类**

在 `frontend/ai-tools/src/utils/aiProductSetService.ts` 中封装：
- `fileToBase64`
- `authorizedJsonFetch`

不要直接复用 `generateProductScene`；新模块保持独立服务入口。

- [ ] **Step 4: 完成上传步骤联动**

仅当商品图列表非空时允许进入“基础模特生成”步骤。

- [ ] **Step 5: 运行类型检查**

Run: `npm run lint`
Expected: 上传状态与步骤流转通过类型检查。

### Task 4: 实现基础模特生成功能

**Files:**
- Modify: `frontend/ai-tools/src/pages/AiProductSet.tsx`
- Modify: `frontend/ai-tools/src/utils/aiProductSetService.ts`
- Modify: `frontend/ai-tools/server/routes/ai-product-set.ts`
- Modify: `frontend/ai-tools/server/tests/ai-product-set.integration.test.ts`

- [ ] **Step 1: 先写基础模特接口测试**

扩展 `frontend/ai-tools/server/tests/ai-product-set.integration.test.ts`，覆盖：
- 参数缺失时返回 `400`
- 已登录且积分不足时返回 `402`
- 合法请求返回 `200` + `modelImages[]`

- [ ] **Step 2: 约定基础模特请求契约**

接口请求体：

```ts
type GenerateBaseModelsBody = {
  products: Array<{ angleLabel: string; imageBase64: string; mimeType: string }>;
  modelConfig: ModelAttributeForm;
  count: 4 | 6;
};
```

接口返回：

```ts
type GenerateBaseModelsResponse = {
  modelImages: string[];
  pointsTotal: number;
  pointsFree: number;
  pointsPaid: number;
};
```

- [ ] **Step 3: 在后端实现模特生成**

`POST /api/ai-product-set/base-models/generate`：
- 校验登录、入参、积分
- 将商品图与模特属性拼装成“服饰试穿基础模特”提示词
- 返回一组基础模特图
- 成功后原子扣积分

提示词必须强调：
- 服饰保持准确
- 主体为同一模特身份
- 输出纯模特穿戴效果，不带额外排版元素

- [ ] **Step 4: 在前端实现模特配置与生成结果区**

页面需包含：
- 性别
- 年龄段
- 人种/地区特征
- 体型
- 外貌细节补充
- 生成数量选择

生成后展示卡片栅格，并允许进入“基础模特选择”步骤。

- [ ] **Step 5: 运行基础模特接口测试**

Run: `npm run test:ai-product-set`
Expected: 基础模特生成相关用例通过。

### Task 5: 实现基础模特选择与场景模板配置

**Files:**
- Modify: `frontend/ai-tools/src/pages/AiProductSet.tsx`

- [ ] **Step 1: 预置场景模板常量**

在页面内或邻近常量中定义至少以下模板：
- `white-studio`
- `city-street`
- `cafe`
- `indoor-home`
- `art-park`

每个模板包含：
- `id`
- `name`
- `description`
- `previewImage`

- [ ] **Step 2: 实现基础模特单选**

要求：
- 明确高亮当前选中的基础模特
- 未选择基础模特时禁止进入场景配置
- 切换模特会清空上一轮场景生成结果

- [ ] **Step 3: 实现场景模板多选与参数控制**

每个模板都支持：
- `景别`: `full | half | three-quarter | close-up`
- `朝向`: `front | side | three-quarter-side | back`

同一模板一条配置记录即可，不支持重复添加相同模板多次，避免 MVP 复杂化。

- [ ] **Step 4: 增加生成前摘要面板**

摘要面板需展示：
- 商品图数量
- 已选基础模特
- 已选模板数量
- 预计生成张数
- 预计扣点

- [ ] **Step 5: 运行类型检查**

Run: `npm run lint`
Expected: 模特选择与模板配置状态无类型错误。

### Task 6: 实现批量套图生成与历史记录持久化

**Files:**
- Modify: `frontend/ai-tools/src/utils/aiProductSetService.ts`
- Modify: `frontend/ai-tools/src/pages/AiProductSet.tsx`
- Modify: `frontend/ai-tools/server/routes/ai-product-set.ts`
- Modify: `frontend/ai-tools/server/tests/ai-product-set.integration.test.ts`

- [ ] **Step 1: 先写批量生成与历史详情测试**

扩展 `frontend/ai-tools/server/tests/ai-product-set.integration.test.ts`，覆盖：
- `POST /api/ai-product-set/batches/generate` 成功后返回批次 ID 与结果数组
- `GET /api/ai-product-set/history` 返回最近记录
- `GET /api/ai-product-set/history/:batchId` 返回结果图与配置快照

- [ ] **Step 2: 约定批量生成请求契约**

```ts
type GenerateBatchBody = {
  products: Array<{ angleLabel: string; imageBase64: string; mimeType: string }>;
  modelConfig: ModelAttributeForm;
  selectedModelImage: string;
  sceneSelections: SceneTemplateSelection[];
};
```

- [ ] **Step 3: 在后端实现批量生成与持久化**

`POST /api/ai-product-set/batches/generate`：
- 为每个场景模板拼接专属提示词
- 统一使用用户选中的基础模特图作为主体
- 并发生成结果图
- 写入 `ai_product_set_batches` 与 `ai_product_set_results`
- 成功后原子扣积分

`GET /history`：
- 返回批次列表摘要

`GET /history/:batchId`：
- 返回批次配置、结果图、生成时间

- [ ] **Step 4: 在前端实现结果管理区**

要求：
- 结果图预览
- 单选 / 多选 / 全选
- 选中项下载
- 全部下载
- “查看生成记录”入口

下载先采用逐张触发浏览器下载，MVP 不引入 zip 打包。

- [ ] **Step 5: 运行批量生成集成测试**

Run: `npm run test:ai-product-set`
Expected: 生成批次、读取历史列表、读取历史详情全部通过。

### Task 7: 完成历史记录面板与收尾验证

**Files:**
- Modify: `frontend/ai-tools/src/pages/AiProductSet.tsx`
- Modify: `frontend/ai-tools/src/pages/Dashboard.tsx`
- Modify: `frontend/ai-tools/server/index.ts`

- [ ] **Step 1: 实现历史记录浏览区**

在 `AiProductSet.tsx` 中提供历史面板，至少展示：
- 批次创建时间
- 模板数量
- 结果张数
- 扣点
- 点击后查看详情

- [ ] **Step 2: 补齐服务端启动日志**

修改 `frontend/ai-tools/server/index.ts`，补充：

```ts
console.log(`   - POST /api/ai-product-set/base-models/generate`);
console.log(`   - POST /api/ai-product-set/batches/generate`);
console.log(`   - GET  /api/ai-product-set/history`);
console.log(`   - GET  /api/ai-product-set/history/:batchId`);
```

- [ ] **Step 3: 做一次端到端人工验证**

Run:
- `npm run server:watch`
- `npm run dev`

人工验证清单：
- 从 Dashboard 进入“AI商品套图”
- 上传 1~3 张服饰图
- 生成基础模特并选择 1 张
- 勾选 2 个以上场景模板
- 批量生成成功
- 多选下载可用
- 历史记录可回看

- [ ] **Step 4: 最终静态检查与集成测试**

Run:
- `npm run lint`
- `npm run test:ai-product-set`
- `npm run test:ai-scene`

Expected:
- 新模块通过
- 旧 `ai-scene` 回归不受影响

- [ ] **Step 5: 提交实现**

```bash
git add frontend/ai-tools/src/pages/AiProductSet.tsx frontend/ai-tools/src/utils/aiProductSetService.ts frontend/ai-tools/src/components/AnimatedRoutes.tsx frontend/ai-tools/src/pages/Dashboard.tsx frontend/ai-tools/server/routes/ai-product-set.ts frontend/ai-tools/server/tests/ai-product-set.integration.test.ts frontend/ai-tools/server/app.ts frontend/ai-tools/server/db.ts frontend/ai-tools/server/index.ts frontend/ai-tools/package.json docs/superpowers/plans/2026-03-19-ai-product-set-workbench.md
git commit -m "feat: add ai product set workbench"
```

## Notes for Execution

- 新模块首页禁止复用 `frontend/ai-tools/src/pages/AiScene.tsx` 作为容器或主视图；可参考其上传、下载、扣点交互方式，但页面结构、状态模型、服务方法必须独立。
- MVP 阶段不引入任务队列、对象存储或 zip 打包，优先完成稳定的单请求批量生成与 SQLite 历史记录。
- 如果 SQLite 存储 `image_data` 导致体积过大，再在后续迭代拆到对象存储；当前计划不提前设计云存储抽象。
