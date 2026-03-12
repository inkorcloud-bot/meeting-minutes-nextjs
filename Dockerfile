# Meeting Minutes Next.js - Docker Image
# 多阶段构建，优化镜像大小

# ============================================
# Stage 1: 依赖安装
# ============================================
FROM node:22-alpine AS deps
WORKDIR /app

# 安装依赖所需的系统包
RUN apk add --no-cache libc6-compat openssl

# 复制 package 文件
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci --include=dev

# ============================================
# Stage 2: 构建
# ============================================
FROM node:22-alpine AS builder
WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache libc6-compat openssl

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 生成 Prisma 客户端
RUN npx prisma generate

# 构建应用
RUN npm run build

# ============================================
# Stage 3: 生产镜像
# ============================================
FROM node:22-alpine AS runner
WORKDIR /app

# 设置时区
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata openssl

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/app/generated/prisma ./app/generated/prisma

# 创建 uploads 目录
RUN mkdir -p uploads && chown nextjs:nodejs uploads

# 切换用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]