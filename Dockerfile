# Meeting Minutes Next.js - Docker Image
# 多阶段构建，优化镜像大小

# ============================================
# Stage 1: 依赖安装
# ============================================
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./prisma.config.ts

RUN npm ci --include=dev

# ============================================
# Stage 2: 构建
# ============================================
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npx prisma generate
RUN npm run build

# 创建数据库模板（用于首次启动）
RUN npx prisma db push && \
    mv ./prisma/dev.db /app/meetings.db.template

# ============================================
# Stage 3: 生产镜像
# ============================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata openssl sqlite

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/app/generated/prisma ./app/generated/prisma
COPY --from=builder /app/meetings.db.template ./meetings.db.template

# 创建目录
RUN mkdir -p /app/data /app/uploads

# 创建 entrypoint 脚本
RUN printf '#!/bin/sh\n\
set -e\n\
mkdir -p /app/data /app/uploads\n\
# 如果数据库不存在，从模板复制\n\
if [ ! -f /app/data/meetings.db ]; then\n\
  echo "Initializing database from template..."\n\
  cp /app/meetings.db.template /app/data/meetings.db\n\
fi\n\
exec node server.js\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 3000

CMD ["/app/entrypoint.sh"]