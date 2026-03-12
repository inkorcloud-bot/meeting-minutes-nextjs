import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { MeetingResponse } from '@/lib/types';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const log = createLogger('api:meeting');

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/meetings/[id]
 * 获取单个会议完整信息
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    
    log.debug('获取会议详情', { meetingId: id });

    const meeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting) {
      log.warn('会议不存在', { meetingId: id });
      return NextResponse.json(
        {
          code: 404,
          message: '会议不存在',
        },
        { status: 404 }
      );
    }

    const response: MeetingResponse = {
      code: 0,
      message: 'success',
      data: {
        id: meeting.id,
        title: meeting.title,
        status: meeting.status,
        audio_path: meeting.audioPath ?? undefined,
        audio_duration: meeting.audioDuration ?? undefined,
        transcript: meeting.transcript ?? undefined,
        summary: meeting.summary ?? undefined,
        progress: meeting.progress,
        current_step: meeting.currentStep ?? undefined,
        error: meeting.error ?? undefined,
        created_at: meeting.createdAt.toISOString(),
        updated_at: meeting.updatedAt.toISOString(),
      },
    };

    const duration = Date.now() - startTime;
    log.info('会议详情获取成功', { 
      meetingId: id, 
      title: meeting.title,
      status: meeting.status,
      duration: `${duration}ms`
    });

    return NextResponse.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('获取会议详情失败', { 
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    });
    
    return NextResponse.json(
      {
        code: 500,
        message: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/meetings/[id]
 * 删除会议记录和关联音频文件
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    
    log.info('删除会议请求', { meetingId: id });

    const meeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting) {
      log.warn('删除失败: 会议不存在', { meetingId: id });
      return NextResponse.json(
        {
          code: 404,
          message: '会议不存在',
        },
        { status: 404 }
      );
    }

    // 删除关联的音频文件
    if (meeting.audioPath) {
      try {
        // 音频路径可能是相对路径或绝对路径
        const audioPath = meeting.audioPath.startsWith('/')
          ? meeting.audioPath
          : join(process.cwd(), 'uploads', meeting.audioPath);

        if (existsSync(audioPath)) {
          await unlink(audioPath);
          log.info('已删除音频文件', { audioPath });
        } else {
          log.warn('音频文件不存在，跳过删除', { audioPath });
        }
      } catch (fileError) {
        // 文件删除失败不影响会议记录删除
        log.warn('删除音频文件失败', { 
          error: fileError instanceof Error ? fileError.message : String(fileError)
        });
      }
    }

    // 删除会议记录
    await prisma.meeting.delete({
      where: { id },
    });

    const duration = Date.now() - startTime;
    log.info('会议删除成功', { 
      meetingId: id, 
      title: meeting.title,
      duration: `${duration}ms`
    });

    return NextResponse.json({
      code: 0,
      message: '删除成功',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('删除会议失败', { 
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    });
    
    return NextResponse.json(
      {
        code: 500,
        message: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}