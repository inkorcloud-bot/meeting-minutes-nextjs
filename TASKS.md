# Meeting Minutes 开发任务拆分

> 每个任务约 50-150 行代码，适合子代理独立处理

---

## 阶段 1: 基础设施 (可并行)

### Task 1: Prisma Schema
**文件**: `prisma/schema.prisma`
**依赖**: 无
**描述**: 定义 Meeting 模型，映射现有 SQLite 表结构

```prisma
model Meeting {
  id             String   @id
  title          String
  date           String?
  participants   String?
  status         String   @default("uploaded")
  audioPath      String?  @map("audio_path")
  audioDuration  Float?   @map("audio_duration")
  transcript     String?
  summary        String?
  progress       Int      @default(0)
  currentStep    String?  @map("current_step")
  error          String?
  asrJobId       String?  @map("asr_job_id")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  @@map("meetings")
}
```

---

### Task 2: 数据库客户端
**文件**: `lib/db.ts`
**依赖**: Task 1
**描述**: 创建 Prisma 客户端单例

---

### Task 3: 类型定义
**文件**: `lib/types.ts`
**依赖**: 无
**描述**: 定义 API 响应类型、会议状态枚举等

---

### Task 4: 环境配置
**文件**: `lib/config.ts`
**依赖**: 无
**描述**: 定义配置类型和默认值

---

## 阶段 2: 服务层 (依赖阶段1)

### Task 5: ASR 客户端
**文件**: `lib/asr-client.ts`
**依赖**: Task 3, Task 4
**描述**: 封装 FireRedASR2S API 调用

**方法**:
- `submitJob(audioPath)` - 提交异步转录任务
- `getJobStatus(jobId)` - 查询任务状态
- `getJobResult(jobId)` - 获取转录结果

---

### Task 6: LLM 客户端
**文件**: `lib/llm-client.ts`
**依赖**: Task 3, Task 4
**描述**: 封装 DeepSeek API 流式调用

**方法**:
- `generateSummaryStream(transcript, options)` - 流式生成纪要

---

## 阶段 3: API 层 (依赖阶段2)

### Task 7: 上传 API
**文件**: `app/api/meetings/upload/route.ts`
**依赖**: Task 2, Task 3
**描述**: 处理音频文件上传，创建会议记录

---

### Task 8: 列表 API
**文件**: `app/api/meetings/route.ts`
**依赖**: Task 2, Task 3
**描述**: 获取会议列表，支持分页

---

### Task 9: 详情 API
**文件**: `app/api/meetings/[id]/route.ts`
**依赖**: Task 2, Task 3
**描述**: 获取/删除单个会议详情

---

### Task 10: 状态 API
**文件**: `app/api/meetings/[id]/status/route.ts`
**依赖**: Task 2, Task 3
**描述**: 获取会议处理状态和进度

---

### Task 11: SSE 重生成 API
**文件**: `app/api/meetings/[id]/regenerate-summary/route.ts`
**依赖**: Task 2, Task 6
**描述**: SSE 流式重新生成纪要

---

## 阶段 4: 后台处理 (依赖阶段2)

### Task 12: 会议处理器
**文件**: `lib/processor.ts`
**依赖**: Task 2, Task 5, Task 6
**描述**: 完整的会议处理流程

**流程**:
1. 提交 ASR 任务
2. 轮询 ASR 状态
3. 获取转录结果
4. 生成会议纪要
5. 保存结果

---

## 阶段 5: 前端页面 (依赖阶段3)

### Task 13: 根布局
**文件**: `app/layout.tsx`, `app/(main)/layout.tsx`
**依赖**: 无
**描述**: 根布局和主布局（导航栏）

---

### Task 14: 上传页面
**文件**: `app/(main)/upload/page.tsx`
**依赖**: Task 13
**描述**: 音频上传界面

---

### Task 15: 列表页面
**文件**: `app/(main)/meetings/page.tsx`
**依赖**: Task 13, Task 17
**描述**: 会议列表，支持状态刷新

---

### Task 16: 详情页面
**文件**: `app/(main)/meeting/[id]/page.tsx`
**依赖**: Task 13, Task 18
**描述**: 会议详情，纪要展示，SSE 重生成

---

## 阶段 6: UI 组件 (可并行)

### Task 17: 会议卡片
**文件**: `components/meeting-card.tsx`
**依赖**: Task 3
**描述**: 列表项卡片，显示标题、状态、进度

---

### Task 18: 纪要查看器
**文件**: `components/summary-viewer.tsx`
**依赖**: 无
**描述**: Markdown 渲染，支持复制

---

### Task 19: 上传表单
**文件**: `components/upload-form.tsx`
**依赖**: Task 3
**描述**: 文件拖拽上传，进度显示

---

### Task 20: 状态标签
**文件**: `components/status-badge.tsx`
**依赖**: Task 3
**描述**: 根据状态显示不同颜色标签

---

## 执行顺序

```
阶段1 (并行): Task 1, 3, 4
阶段1 (串行): Task 2 (依赖 Task 1)
阶段2 (并行): Task 5, 6 (依赖阶段1)
阶段3 (并行): Task 7, 8, 9, 10, 11 (依赖阶段2)
阶段4 (串行): Task 12 (依赖阶段2)
阶段6 (并行): Task 17, 18, 19, 20
阶段5 (串行): Task 13, 14, 15, 16 (依赖阶段3和阶段6)
```

---

## 子代理任务文件

每个子代理需要：
1. 读取 `DESIGN.md` 了解整体设计
2. 读取相关依赖文件
3. 创建/修改目标文件
4. 确保类型正确、无 lint 错误