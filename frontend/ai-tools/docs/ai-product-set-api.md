# AI Product Set API（联调文档）

基地址：`/api/ai-product-set`
鉴权：除公开健康检查外，均需 `Authorization: Bearer <token>`

## 1. POST `/base-models/generate`

用途：基于商品图与模特属性生成基准模特图（当前支持 4 或 6 张）。

### Request

```json
{
  "products": [
    {
      "angleLabel": "正面",
      "imageBase64": "<base64>",
      "mimeType": "image/png"
    }
  ],
  "modelConfig": {
    "gender": "female",
    "ageGroup": "young-adult",
    "ethnicity": "欧美白人",
    "bodyType": "标准",
    "appearanceNotes": "自然微笑"
  },
  "count": 4
}
```

### Response 200

```json
{
  "modelImages": ["data:image/png;base64,..."],
  "pointsTotal": 220,
  "pointsFree": 220,
  "pointsPaid": 0
}
```

### Errors
- `400`：参数缺失或格式错误
- `401`：未登录或 token 无效
- `402`：积分不足
- `404`：用户不存在
- `500`：服务异常

计费：`count * 20`

---

## 2. POST `/scenes/recommend`

用途：基于已选基准模特返回推荐场景列表（不扣费）。

### Request

```json
{
  "selectedModelImage": "data:image/png;base64,..."
}
```

### Response 200

```json
{
  "items": [
    {
      "templateId": "white-studio",
      "group": "纯白棚拍",
      "description": "自然站立双手轻搭裤缝，目光平视镜头，完整展示T恤版型与印花",
      "framing": "full",
      "facing": "front"
    }
  ]
}
```

### Errors
- `400`：缺少 `selectedModelImage`
- `401`：未登录或 token 无效

---

## 3. POST `/batches/generate`

用途：按场景配置批量生成场景图，保存批次与结果，成功后扣费。

### Request

```json
{
  "products": [
    {
      "angleLabel": "正面",
      "imageBase64": "<base64>",
      "mimeType": "image/png"
    }
  ],
  "modelConfig": {
    "gender": "female",
    "ageGroup": "young-adult",
    "ethnicity": "欧美白人",
    "bodyType": "标准",
    "appearanceNotes": "自然微笑"
  },
  "selectedModelImage": "data:image/png;base64,...",
  "sceneSelections": [
    {
      "templateId": "city-street",
      "framing": "full",
      "facing": "front"
    },
    {
      "templateId": "cafe",
      "framing": "three-quarter",
      "facing": "side"
    }
  ]
}
```

### Response 200

```json
{
  "batchId": "uuid",
  "resultCount": 2,
  "totalCost": 60,
  "results": [
    {
      "id": "uuid",
      "sceneCode": "city-street",
      "framing": "full",
      "facing": "front",
      "imageData": "data:image/png;base64,...",
      "sortOrder": 0,
      "createdAt": "2026-03-20T10:20:30.000Z"
    }
  ],
  "pointsTotal": 160,
  "pointsFree": 160,
  "pointsPaid": 0
}
```

### Errors
- `400`：参数不完整或场景配置不合法
- `401`：未登录或 token 无效
- `402`：积分不足
- `404`：用户不存在
- `500`：服务异常

计费：`sceneSelections.length * 30`

---

## 4. GET `/history`

用途：获取当前用户历史批次摘要。

### Response 200

```json
{
  "items": [
    {
      "id": "uuid",
      "resultCount": 2,
      "totalCost": 60,
      "createdAt": "2026-03-20 18:20:30"
    }
  ]
}
```

---

## 5. GET `/history/:batchId`

用途：获取某个批次的配置快照与结果明细。

### Response 200

```json
{
  "id": "uuid",
  "products": [],
  "modelConfig": {},
  "selectedModelImage": "data:image/png;base64,...",
  "sceneSelections": [],
  "resultCount": 2,
  "totalCost": 60,
  "createdAt": "2026-03-20 18:20:30",
  "results": [
    {
      "id": "uuid",
      "sceneCode": "city-street",
      "framing": "full",
      "facing": "front",
      "imageData": "data:image/png;base64,...",
      "sortOrder": 0,
      "createdAt": "2026-03-20 18:20:30"
    }
  ]
}
```

### Errors
- `401`：未登录或 token 无效
- `404`：批次不存在或不属于当前用户

---

## 6. 生成引擎说明

- 默认使用 Hugging Face 推理 API 进行真实生图。
- 关键配置：
  - `IMAGE_PROVIDER=hf`
  - `HF_API_URL`（默认 `https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0`）
  - `HF_API_TOKEN`（推荐配置，避免限频和权限问题）
  - `HF_MAX_RETRIES`（默认 `4`）
- 当 Hugging Face 调用失败、超时或限流时，会自动回退到稳定 mock 图（不会中断主流程）。
- 扣费策略不变：仅在生成成功并写入批次后扣费。
