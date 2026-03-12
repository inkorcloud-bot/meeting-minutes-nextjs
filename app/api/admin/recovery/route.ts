import { NextRequest, NextResponse } from 'next/server';
import { runRecovery, getRecoveryStatus } from '@/lib/recovery';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:recovery');

/**
 * GET /api/admin/recovery
 * Get status of meetings in interrupted states
 */
export async function GET() {
  try {
    const status = await getRecoveryStatus();
    
    return NextResponse.json({
      code: 0,
      message: 'success',
      data: status,
    });
  } catch (error) {
    log.error('获取恢复状态失败', { 
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json({
      code: 500,
      message: '获取恢复状态失败',
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/recovery
 * Manually trigger recovery for interrupted meetings
 * 
 * Body:
 * - autoRetry: boolean (default: true)
 * - maxAgeHours: number (default: 24)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const config = {
      autoRetry: body.autoRetry ?? true,
      maxAgeHours: body.maxAgeHours ?? 24,
      staggerDelayMs: 3000,
    };
    
    log.info('手动触发状态恢复', { config });
    
    const result = await runRecovery(config);
    
    return NextResponse.json({
      code: 0,
      message: 'success',
      data: result,
    });
  } catch (error) {
    log.error('手动恢复失败', { 
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json({
      code: 500,
      message: '恢复失败',
    }, { status: 500 });
  }
}