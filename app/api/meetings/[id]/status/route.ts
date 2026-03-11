import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { StatusResponse, StatusResponseData } from '@/lib/types';

/**
 * GET /api/meetings/[id]/status
 * 获取会议处理状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get meeting status:', error);
    
    const response: StatusResponse = {
      code: 500,
      message: 'Internal server error',
    };
    return NextResponse.json(response, { status: 500 });
  }
}