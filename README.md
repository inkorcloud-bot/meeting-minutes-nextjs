# Meeting Minutes App

智能会议纪要生成器 — 上传音频，自动转录并生成结构化会议纪要。

## ✨ 功能特性

- **🎙️ 音频上传** — 支持 WebM/WAV/MP3 等格式，最大 500MB
- **📝 自动转录** — 集成 FireRedASR2S 语音识别服务
- **🤖 智能纪要** — LLM 自动生成结构化会议纪要
- **✏️ 纪要编辑** — 分屏编辑器，Markdown 实时预览
- **📊 进度追踪** — 实时显示处理状态和进度
- **🔄 断点续传** — 服务重启自动恢复中断任务
- **🐳 容器化部署** — Docker Compose 一键部署

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 5 |
| 数据库 | SQLite + Prisma 7 |
| 样式 | Tailwind CSS 4 |
| UI | shadcn/ui + Lucide Icons |
| 状态 | SWR |
| ASR | FireRedASR2S API |
| LLM | OpenAI / DeepSeek 兼容 API |

## 🚀 快速开始

### 环境要求

- Node.js 20+
- npm 或 pnpm

### 1. 安装依赖

```bash
cd meeting-minutes-app
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# 数据库 (SQLite)
DATABASE_URL="file:./prisma/dev.db"

# ASR 服务
ASR_API_URL="http://localhost:8000"

# LLM 服务
LLM_API_KEY="your-api-key"
LLM_API_URL="https://api.openai.com/v1"
LLM_MODEL="gpt-4o-mini"
```

### 3. 初始化数据库

```bash
npm run db:push
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 📁 项目结构

```
meeting-minutes-app/
├── app/
│   ├── api/
│   │   ├── meetings/
│   │   │   ├── upload/route.ts      # 音频上传 API
│   │   │   ├── route.ts             # 会议列表 API
│   │   │   └── [id]/
│   │   │       ├── route.ts         # 会议 CRUD API
│   │   │       ├── status/route.ts  # 状态查询 API
│   │   │       └── regenerate-summary/route.ts  # SSE 重生成
│   │   └── admin/recovery/route.ts  # 手动恢复 API
│   ├── (main)/
│   │   ├── upload/page.tsx          # 上传页面
│   │   ├── meetings/page.tsx        # 会议列表
│   │   └── meeting/[id]/page.tsx    # 会议详情 + 编辑
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                          # shadcn/ui 组件
│   ├── upload-form.tsx              # 上传表单
│   ├── meeting-card.tsx             # 会议卡片
│   ├── status-badge.tsx             # 状态标签
│   ├── summary-viewer.tsx           # Markdown 渲染
│   ├── summary-editor.tsx           # 简单编辑器
│   ├── meeting-editor.tsx           # 分屏编辑器
│   └── markdown-editor.tsx          # Markdown 编辑器
├── lib/
│   ├── db.ts                        # Prisma 客户端
│   ├── config.ts                    # 配置管理
│   ├── types.ts                     # 类型定义
│   ├── asr-client.ts                # ASR API 客户端
│   ├── llm-client.ts                # LLM API 客户端
│   ├── llm-semaphore.ts             # 并发控制
│   ├── processor.ts                 # 核心处理流程
│   ├── recovery.ts                  # 断点恢复
│   └── logger.ts                    # 日志工具
├── prisma/
│   └── schema.prisma                # 数据库模型
├── uploads/                         # 音频文件存储
└── instrumentation.ts               # 启动钩子
```

## 🔌 API 文档

### 会议管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/meetings/upload` | 上传音频文件 |
| GET | `/api/meetings` | 获取会议列表 |
| GET | `/api/meetings/:id` | 获取会议详情 |
| PUT | `/api/meetings/:id` | 更新会议（summary/transcript） |
| DELETE | `/api/meetings/:id` | 删除会议 |
| GET | `/api/meetings/:id/status` | 获取处理状态 |
| POST | `/api/meetings/:id/regenerate-summary` | SSE 流式重生成纪要 |

### 请求示例

**上传音频**
```bash
curl -X POST http://localhost:3000/api/meetings/upload \
  -F "audio=@meeting.webm" \
  -F "title=项目周会" \
  -F "participants=张三,李四"
```

**更新纪要**
```bash
curl -X PUT http://localhost:3000/api/meetings/abc123 \
  -H "Content-Type: application/json" \
  -d '{"summary": "## 会议要点\n..."}'
```

## 🔄 核心处理流程

```
音频上传
    ↓
创建会议记录 (status: uploaded)
    ↓
提交 ASR 任务
    ↓
轮询 ASR 状态 (status: transcribing)
    ↓
获取转录文本
    ↓
LLM 生成纪要 (status: summarizing)
    ↓
保存结果 (status: completed)
```

## 🐳 Docker 部署

```bash
# 构建镜像
docker build -t meeting-minutes-app .

# 使用 Docker Compose
docker-compose up -d
```

**docker-compose.yml** 包含：
- Next.js 应用
- SQLite 数据卷
- ASR 服务容器（可选）

## 📝 开发指南

### 数据库迁移

```bash
# 开发环境：推送 schema 变更
npm run db:push

# 生产环境：创建迁移
npm run db:migrate
```

### 代码规范

- TypeScript 严格模式
- 服务端组件优先
- API 路由遵循 RESTful 规范
- 组件使用 `"use client"` 标记客户端组件

### 日志

使用 `lib/logger.ts` 统一日志：

```typescript
import { createLogger } from '@/lib/logger';

const log = createLogger('module-name');
log.info('消息', { context: 'data' });
log.error('错误', { error: err.message });
```

## ⚠️ 注意事项

1. **Prisma 7 配置** — 数据库 URL 在 `prisma.config.ts` 中配置，不在 `schema.prisma`
2. **LLM 并发** — 通过 `LLM_MAX_CONCURRENT` 控制并发数，默认 5
3. **文件大小** — 默认最大 500MB，可通过 `MAX_FILE_SIZE` 调整
4. **断点恢复** — 服务启动时自动恢复 `transcribing`/`summarizing` 状态的任务

## 📄 License

MIT