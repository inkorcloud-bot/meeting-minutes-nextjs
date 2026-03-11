import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { MeetingResponse } from '@/lib/types';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/meetings/[id]
 * 获取单个会议完整信息
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting) {
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取会议详情失败:', error);
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
  try {
    const { id } = await params;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting) {
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
          console.log(`已删除音频文件: ${audioPath}`);
        }
      } catch (fileError) {
        // 文件删除失败不影响会议记录删除
        console.warn('删除音频文件失败:', fileError);
      }
    }

    // 删除会议记录
    await prisma.meeting.delete({
      where: { id },
    });

    return NextResponse.json({
      code: 0,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除会议失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}