# AI Product Set Flow Revamp Plan (图一到图七)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按图一到图七重构 `ai-product-set` 的完整流程与交互，在保持现有 UI 风格的前提下，完成从上传商品图到最终下载结果的闭环。

**Scope:** 仅改造 `ai-product-set` 页面及其对应前后端接口，不改动 `ai-scene` 主流程。

**Non-Goals:**
- 不做全新视觉风格改版（需保持现有风格）。
- 不引入任务队列、对象存储、zip 打包（维持 MVP）。

**Tech Stack:** React 19 + TypeScript + Tailwind + Express + SQLite + 现有鉴权/积分体系。

---

## 1) 目标流程状态机（对应图一~图七）

定义页面主状态：

```ts
export type AiProductSetFlowState =
  | 'upload-empty'            // 图一：初始状态，提醒上传服装图
  | 'upload-ready'            // 图二：已有服装图，提示生成基准模特
  | 'base-model-generating'   // 图三：生成基准模特中
  | 'base-model-ready'        // 图四：已生成基准模特，提示生成推荐场景
  | 'scene-recommend-generating' // 图五：推荐场景生成中
  | 'scene-select-ready'      // 图六：场景可选，提示生成场景图片
  | 'result-ready';           // 图七：最终结果，支持下载
```

状态跳转规则：
- `upload-empty` -> `upload-ready`: 至少上传 1 张服装图。
- `upload-ready` -> `base-model-generating`: 点击“生成基准模特”。
- `base-model-generating` -> `base-model-ready`: 接口成功返回模特图。
- `base-model-ready` -> `scene-recommend-generating`: 点击“生成推荐场景”。
- `scene-recommend-generating` -> `scene-select-ready`: 推荐场景返回。
- `scene-select-ready` -> `result-ready`: 点击“生成场景图片”并成功返回结果。

回退与重置规则：
- 更换服装图：重置到 `upload-ready`，清空后续模特、场景、结果。
- 更换基准模特：保留场景模板列表但清空已生成结果。
- 修改场景勾选：仅影响结果生成，不回退前序步骤。

---

## 2) 页面与交互要求（保持现有 UI 风格）

### 图一：初始态
- 左侧上传区为空态卡片 + 主按钮禁用文案：`请先上传服装图片`。
- 右侧保持当前营销预览区，不出现结果内容。

### 图二：上传后
- 左侧显示服装缩略图列表（支持删除、追加）。
- 主按钮切换为：`生成基准模特`（可点击）。

### 图三：基准模特生成中
- `生成基准模特` 按钮进入 loading，文案：`基准模特生成中...`。
- 模特展示区显示骨架/占位，不允许进入下一步。

### 图四：基准模特生成完成
- 展示可选基准模特卡片（单选，默认选中第一张）。
- 主按钮切换为：`生成推荐场景`（需有已选模特）。

### 图五：推荐场景生成中
- 场景列表区域展示 loading 占位。
- 禁止点击“生成场景图片”。

### 图六：场景可选
- 场景按分组展示，可勾选；每条支持 `景别` 和 `朝向` 下拉。
- 底部主按钮：`生成场景图片（N张）`，N 为当前勾选总数。

### 图七：结果页
- 右侧展示结果卡片网格（可多选）。
- 顶部提供 `全选` 与 `下载`；至少支持单张/多张逐张下载。

---

## 3) 前端改造任务（ai-product-set）

**Files:**
- Modify: `frontend/ai-tools/src/pages/AiProductSet.tsx`
- Modify: `frontend/ai-tools/src/pages/aiProductSetWorkflow.ts`
- Modify: `frontend/ai-tools/src/utils/aiProductSetService.ts`

- [ ] **Task A: 补全 workflow helper 的状态与推导**
- 增加图一到图七的完整状态类型。
- 提供按钮文案、按钮 disabled、loading 标记 derivation helper。
- 提供重置函数：`resetAfterProductChange`、`resetAfterBaseModelChange`。

- [ ] **Task B: 重构页面主状态与分区渲染**
- 用单一 flow state 驱动左侧步骤区和底部主按钮。
- 右侧在 `result-ready` 前保持预览区；`result-ready` 后切换结果管理区。
- 保持现有样式 token（圆角、间距、颜色层级）一致，不引入新视觉体系。

- [ ] **Task C: 接入真实交互事件链**
- 上传成功后进入 `upload-ready`。
- 点击“生成基准模特”触发 `generateBaseModels`，并处理 loading/错误 toast。
- 点击“生成推荐场景”触发推荐接口（可先复用后端 mock，再切换真实）。
- 点击“生成场景图片”触发批量生成，成功切到 `result-ready`。

- [ ] **Task D: 结果管理交互**
- 支持结果多选、全选、下载。
- 支持回看最近一次批次（可从 history 拉取）。

---

## 4) 后端改造任务（ai-product-set）

**Files:**
- Modify: `frontend/ai-tools/server/routes/ai-product-set.ts`
- Modify: `frontend/ai-tools/server/tests/ai-product-set.integration.test.ts`

- [ ] **Task E: 基准模特生成接口落地**
- 实现 `POST /api/ai-product-set/base-models/generate`。
- 校验：登录、必填参数、积分。
- 返回：`modelImages[]` + 最新积分信息。

- [ ] **Task F: 推荐场景接口（新增）**
- 新增 `POST /api/ai-product-set/scenes/recommend`。
- 输入：选中基准模特 + 商品图/属性。
- 返回：推荐场景列表（含默认景别/朝向）。

- [ ] **Task G: 批量场景图生成接口落地**
- 实现 `POST /api/ai-product-set/batches/generate`。
- 保存 batch + result 明细到 SQLite。
- 成功后原子扣积分。

---

## 5) 测试与验收（按图一~图七）

**Files:**
- Modify: `frontend/ai-tools/scripts/ai-product-set-workflow.test.ts`
- Modify: `frontend/ai-tools/server/tests/ai-product-set.integration.test.ts`

- [ ] **Test 1: 流程状态机单测**
- 覆盖图一到图七所有阶段推导。
- 覆盖“上传替换后重置 downstream”规则。

- [ ] **Test 2: 后端集成测试**
- base-model、scenes/recommend、batches/generate、history、history/:id。
- 覆盖鉴权失败、参数失败、积分不足、成功链路。

- [ ] **Test 3: 人工验收清单**
- 图一：初始提示上传。
- 图二：上传后提示生成基准模特。
- 图三：基准模特生成中有 loading。
- 图四：基准模特可见且可选，提示生成推荐场景。
- 图五：推荐场景生成中有 loading。
- 图六：场景可选并可配置景别/朝向，按钮显示生成数量。
- 图七：结果展示并可下载到本地。

---

## 6) 实施顺序建议（低风险）

1. 先完善 `aiProductSetWorkflow.ts` 状态机与单测。
2. 再改 `AiProductSet.tsx` 让 UI 完整跑通 7 态（先可 mock）。
3. 最后落地后端接口并接入真实数据。
4. 收尾做 lint + 集成测试 + 人工验收。

---

## 7) 当前差距快照（基于现状）

- `AiProductSet.tsx` 目前仅完成上传主流程，后续阶段仍是占位。
- `POST /api/ai-product-set/base-models/generate` 当前返回 `501`。
- `POST /api/ai-product-set/batches/generate` 当前返回 `501`。
- 还缺少推荐场景接口与对应前端服务方法。
