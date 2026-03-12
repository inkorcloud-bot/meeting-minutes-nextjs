import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:asr-test');

/**
 * GET /api/admin/asr-test
 * 测试 ASR 服务连接状态
 */
export async function GET() {
  const testUrl = `${config.asrApiUrl}/health`;
  
  log.info('测试 ASR 服务连接', { 
    configuredUrl: config.asrApiUrl,
    testUrl 
  });

  try {
    const startTime = Date.now();
    const response = await fetch(testUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
    const duration = Date.now() - startTime;

    const contentType = response.headers.get('content-type');
    let body: unknown;
    
    if (contentType?.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text().catch(() => 'Unable to read body');
    }

    log.info('ASR 服务响应', { 
      status: response.status,
      duration: `${duration}ms`,
      body 
    });

    return NextResponse.json({
      code: 0,
      message: 'success',
      data: {
        connected: response.ok,
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        configuredUrl: config.asrApiUrl,
        testUrl,
        response: body,
      },
    });
  } catch (error) {
    const duration = Date.now();
    
    log.error('ASR 服务连接失败', { 
      testUrl,
      configuredUrl: config.asrApiUrl,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      code: (error as NodeJS.ErrnoException)?.code
    });

    return NextResponse.json({
      code: 500,
      message: '连接 ASR 服务失败',
      data: {
        connected: false,
        configuredUrl: config.asrApiUrl,
        testUrl,
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        code: (error as NodeJS.ErrnoException)?.code,
      },
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/asr-test
 * 测试提交 ASR 任务
 */
export async function POST(request: NextRequest) {
  const { asrClient } = await import('@/lib/asr-client');
  
  try {
    const body = await request.json().catch(() => ({}));
    const audioPath = body.audioPath;
    
    if (!audioPath) {
      return NextResponse.json({
        code: 400,
        message: '缺少 audioPath 参数',
      }, { status: 400 });
    }

    log.info('测试提交 ASR 任务', { audioPath });

    const jobId = await asrClient.submitJob(audioPath);

    return NextResponse.json({
      code: 0,
      message: 'success',
      data: {
        jobId,
        audioPath,
      },
    });
  } catch (error) {
    log.error('测试提交失败', { 
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      code: 500,
      message: error instanceof Error ? error.message : '提交失败',
    }, { status: 500 });
  }
}