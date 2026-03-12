import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import prisma from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { processMeeting } from '@/lib/processor';
import type { UploadResponse } from '@/lib/types';

const log = createLogger('api:upload');

/**
 * ASR_API 支持的所有音频/视频格式
 * 与 FireRedASR2S 兼容的完整格式列表
 */
const ALLOWED_AUDIO_EXTENSIONS = new Set([
  '3gp', '3g2', '8svx', 'aa', 'aac', 'aax', 'ac3', 'act', 'adp', 'adts',
  'adx', 'aif', 'aiff', 'amr', 'ape', 'asf', 'ast', 'au', 'avr', 'caf',
  'cda', 'dff', 'dsf', 'dsm', 'dss', 'dts', 'eac3', 'ec3', 'f32', 'f64',
  'fap', 'flac', 'flv', 'gsm', 'ircam', 'm2ts', 'm4a', 'm4b', 'm4r',
  'mka', 'mkv', 'mp2', 'mp3', 'mp4', 'mpc', 'mpp', 'mts', 'nut', 'nsv',
  'oga', 'ogg', 'oma', 'opus', 'qcp', 'ra', 'ram', 'rm', 'sln', 'smp',
  'snd', 'sox', 'spx', 'tak', 'tta', 'voc', 'w64', 'wav', 'wave', 'webm',
  'wma', 'wve', 'wv', 'xa', 'xwma',
]);

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
  const startTime = Date.now();
  
  try {
    // 解析 multipart/form-data
    const formData = await request.formData();

    // 获取表单字段
    const audioFile = formData.get('audio') as File | null;
    const title = formData.get('title') as string | null;
    const date = formData.get('date') as string | null;
    const participants = formData.get('participants') as string | null;

    log.info('收到上传请求', { 
      fileName: audioFile?.name, 
      fileSize: audioFile?.size, 
      title,
      hasDate: !!date,
      hasParticipants: !!participants 
    });

    // 验证必需字段
    if (!audioFile) {
      log.warn('上传失败: 缺少音频文件');
      return NextResponse.json({
        code: 400,
        message: '缺少音频文件',
      }, { status: 400 });
    }

    if (!title) {
      log.warn('上传失败: 缺少会议标题', { fileName: audioFile.name });
      return NextResponse.json({
        code: 400,
        message: '缺少会议标题',
      }, { status: 400 });
    }

    // 生成 UUID
    const meetingId = randomUUID();

    // 获取文件扩展名并验证
    const originalName = audioFile.name;
    const ext = path.extname(originalName).slice(1).toLowerCase();

    if (!ext || !ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
      log.warn('上传失败: 不支持的文件格式', { fileName: originalName, ext });
      return NextResponse.json({
        code: 400,
        message: `不支持的文件格式 '${ext || '未知'}'。支持 MP3, WAV, M4A, OGG, FLAC, AAC, OPUS 等 ${ALLOWED_AUDIO_EXTENSIONS.size} 种格式`,
      }, { status: 400 });
    }

    const fileName = `${meetingId}.${ext}`;
    log.debug('生成文件名', { meetingId, fileName, ext });

    // 确保 uploads 目录存在
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      log.info('创建 uploads 目录', { uploadsDir });
      await mkdir(uploadsDir, { recursive: true });
    }

    // 保存文件
    const filePath = path.join(uploadsDir, fileName);
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);
    
    log.info('文件保存成功', { 
      filePath, 
      fileSize: audioFile.size,
      fileSizeMB: (audioFile.size / 1024 / 1024).toFixed(2)
    });

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

    const duration = Date.now() - startTime;
    log.info('会议记录创建成功', { 
      meetingId: meeting.id, 
      title: meeting.title,
      duration: `${duration}ms`
    });

    // 启动后台处理任务（不阻塞响应）
    // 使用 setTimeout 确保异步执行
    setTimeout(() => {
      log.info('启动后台处理任务', { meetingId: meeting.id });
      processMeeting(meeting.id).catch(error => {
        log.error('后台处理任务失败', { 
          meetingId: meeting.id, 
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, 100);

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
    const duration = Date.now() - startTime;
    log.error('上传处理失败', { 
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    });

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