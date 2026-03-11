import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { MeetingListResponse, MeetingListItem } from '@/lib/types';

/**
 * GET /api/meetings
 * 获取会议列表
 * 
 * 功能:
 * - 查询所有会议，按创建时间倒序排列
 * - 返回列表项 (id, title, status, progress, created_at)
 */
export async function GET(): Promise<NextResponse<MeetingListResponse>> {
  try {
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

    return NextResponse.json({
      code: 0,
      message: 'success',
      data: {
        total: items.length,
        items,
      },
    });
  } catch (error) {
    console.error('Failed to fetch meetings:', error);
    return NextResponse.json({
      code: 500,
      message: 'Failed to fetch meetings',
    }, { status: 500 });
  }
}