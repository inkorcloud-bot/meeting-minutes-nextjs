import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { StatusResponse, StatusResponseData } from '@/lib/types';

const log = createLogger('api:status');

/**
 * GET /api/meetings/[id]/status
 * 获取会议处理状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;

    log.debug('获取会议状态', { meetingId: id });

    // 查询会议记录
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        progress: true,
        currentStep: true,
        error: true,
      },
    });

    // 会议不存在
    if (!meeting) {
      log.warn('会议不存在', { meetingId: id });
      const response: StatusResponse = {
        code: 404,
        message: 'Meeting not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // 构建响应数据
    const data: StatusResponseData = {
      meeting_id: meeting.id,
      status: meeting.status,
      progress: meeting.progress,
      current_step: meeting.currentStep || undefined,
      error: meeting.error || undefined,
    };

    const response: StatusResponse = {
      code: 0,
      message: 'success',
      data,
    };

    const duration = Date.now() - startTime;
    log.debug('会议状态获取成功', { 
      meetingId: id, 
      status: meeting.status,
      progress: meeting.progress,
      duration: `${duration}ms`
    });

    return NextResponse.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('获取会议状态失败', { 
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    });
    
    const response: StatusResponse = {
      code: 500,
      message: 'Internal server error',
    };
    return NextResponse.json(response, { status: 500 });
  }
}