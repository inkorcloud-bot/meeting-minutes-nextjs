import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import prisma from '@/lib/db';
import type { UploadResponse } from '@/lib/types';

/**
 * POST /api/meetings/upload
 * 上传音频文件并创建会议记录
 *
 * 功能:
 * - 接收 multipart/form-data (audio, title, date, participants)
 * - 保存音频文件到 uploads/ 目录
 * - 创建 Meeting 数据库记录
 * - 返回 meeting_id 和状态
 *
 * 响应格式:
 * {
 *   "code": 0,
 *   "message": "success",
 *   "data": {
 *     "meeting_id": "uuid",
 *     "status": "uploaded",
 *     "estimated_processing_time": "约 2-5 分钟"
 *   }
 * }
 */
export async function POST(request: Request): Promise<NextResponse<UploadResponse>> {
  try {
    // 解析 multipart/form-data
    const formData = await request.formData();

    // 获取表单字段
    const audioFile = formData.get('audio') as File | null;
    const title = formData.get('title') as string | null;
    const date = formData.get('date') as string | null;
    const participants = formData.get('participants') as string | null;

    // 验证必需字段
    if (!audioFile) {
      return NextResponse.json({
        code: 400,
        message: '缺少音频文件',
      }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({
        code: 400,
        message: '缺少会议标题',
      }, { status: 400 });
    }

    // 验证文件类型
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-m4a', 'audio/mp4', 'audio/webm'];
    if (!allowedTypes.includes(audioFile.type) && !audioFile.name.match(/\.(mp3|wav|m4a|webm)$/i)) {
      return NextResponse.json({
        code: 400,
        message: '不支持的音频格式，支持: MP3, WAV, M4A, WebM',
      }, { status: 400 });
    }

    // 生成 UUID
    const meetingId = randomUUID();

    // 获取文件扩展名
    const originalName = audioFile.name;
    const ext = path.extname(originalName) || '.mp3';
    const fileName = `${meetingId}${ext}`;

    // 确保 uploads 目录存在
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // 保存文件
    const filePath = path.join(uploadsDir, fileName);
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // 创建 Meeting 数据库记录
    const meeting = await prisma.meeting.create({
      data: {
        id: meetingId,
        title,
        date: date || null,
        participants: participants || null,
        status: 'uploaded',
        audioPath: fileName,
        progress: 0,
      },
    });

    // 返回成功响应
    return NextResponse.json({
      code: 0,
      message: 'success',
      data: {
        meeting_id: meeting.id,
        status: meeting.status,
        estimated_processing_time: '约 2-5 分钟',
      },
    });
  } catch (error) {
    console.error('Upload error:', error);

    // 判断错误类型返回不同的响应
    if (error instanceof Error) {
      return NextResponse.json({
        code: 500,
        message: `上传失败: ${error.message}`,
      }, { status: 500 });
    }

    return NextResponse.json({
      code: 500,
      message: '上传失败，请稍后重试',
    }, { status: 500 });
  }
}