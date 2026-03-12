import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { MeetingListResponse, MeetingListItem } from '@/lib/types';

const log = createLogger('api:meetings');

/**
 * GET /api/meetings
 * 获取会议列表
 * 
 * 功能:
 * - 查询所有会议，按创建时间倒序排列
 * - 返回列表项 (id, title, status, progress, created_at)
 */
export async function GET(): Promise<NextResponse<MeetingListResponse>> {
  const startTime = Date.now();
  
  try {
    log.debug('获取会议列表');

    // 查询所有会议，按创建时间倒序
    const meetings = await prisma.meeting.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        createdAt: true,
      },
    });

    // 转换为响应格式
    const items: MeetingListItem[] = meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      status: meeting.status,
      progress: meeting.progress,
      created_at: meeting.createdAt.toISOString(),
    }));

    const duration = Date.now() - startTime;
    log.info('会议列表获取成功', { count: items.length, duration: `${duration}ms` });

    return NextResponse.json({
      code: 0,
      message: 'success',
      data: {
        total: items.length,
        items,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('获取会议列表失败', { 
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    });
    
    return NextResponse.json({
      code: 500,
      message: 'Failed to fetch meetings',
    }, { status: 500 });
  }
}