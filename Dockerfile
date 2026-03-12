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

# ============================================
# Stage 3: 生产镜像
# ============================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata openssl

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
# 复制 prisma 相关模块（用于 db push）
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 创建 entrypoint 脚本
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# 确保数据目录存在' >> /app/entrypoint.sh && \
    echo 'mkdir -p /app/data /app/uploads' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# 初始化数据库（如果不存在）' >> /app/entrypoint.sh && \
    echo 'if [ ! -f /app/data/meetings.db ]; then' >> /app/entrypoint.sh && \
    echo '  echo "Initializing database..."' >> /app/entrypoint.sh && \
    echo '  cd /app && ./node_modules/.bin/prisma db push --skip-generate' >> /app/entrypoint.sh && \
    echo 'fi' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'exec node server.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 3000

CMD ["/app/entrypoint.sh"]