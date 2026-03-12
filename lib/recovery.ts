/**
 * Meeting State Recovery Service
 *
 * Handles recovery of meetings that were interrupted during processing.
 * This runs on server startup to ensure meetings don't get stuck in
 * intermediate states like 'uploaded', 'processing', 'transcribing', etc.
 */

import { prisma } from './db';
import { createLogger } from './logger';
import { processMeeting } from './processor';

const log = createLogger('recovery');

/**
 * States that indicate a meeting was interrupted during processing
 */
const INTERRUPTED_STATES = ['uploaded', 'processing', 'transcribing', 'summarizing', 're-summarizing'] as const;

/**
 * Recovery strategy configuration
 */
export interface RecoveryConfig {
  // Whether to automatically retry processing interrupted meetings
  autoRetry: boolean;
  
  // Maximum age (in hours) of meetings to retry
  // Meetings older than this will be marked as failed instead
  maxAgeHours: number;
  
  // Delay between starting each recovery job (in ms)
  // Helps avoid overwhelming the system on startup
  staggerDelayMs: number;
}

/**
 * Default recovery configuration
 */
const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  autoRetry: true,
  maxAgeHours: 24,
  staggerDelayMs: 2000,
};

/**
 * Find all meetings in interrupted states
 */
async function findInterruptedMeetings(maxAgeHours: number): Promise<Array<{
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  audioPath: string | null;
}>> {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const meetings = await prisma.meeting.findMany({
    where: {
      status: { in: [...INTERRUPTED_STATES] },
      createdAt: { gte: cutoffTime },
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      audioPath: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return meetings;
}

/**
 * Mark a meeting as failed
 */
async function markAsFailed(meetingId: string, reason: string): Promise<void> {
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: 'failed',
      progress: 0,
      error: reason,
      currentStep: null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run recovery process for interrupted meetings
 *
 * @param config - Recovery configuration
 * @returns Summary of recovery actions taken
 */
export async function runRecovery(
  config: Partial<RecoveryConfig> = {}
): Promise<{
  found: number;
  retried: number;
  failed: number;
  skipped: number;
}> {
  const recoveryConfig = { ...DEFAULT_RECOVERY_CONFIG, ...config };
  const result = {
    found: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
  };

  log.info('开始状态恢复检查', { config: recoveryConfig });

  try {
    // Find interrupted meetings
    const interruptedMeetings = await findInterruptedMeetings(recoveryConfig.maxAgeHours);
    result.found = interruptedMeetings.length;

    if (interruptedMeetings.length === 0) {
      log.info('没有发现需要恢复的会议');
      return result;
    }

    log.info('发现中断状态的会议', { 
      count: interruptedMeetings.length,
      meetings: interruptedMeetings.map(m => ({ id: m.id, title: m.title, status: m.status }))
    });

    // Check if auto-retry is disabled
    if (!recoveryConfig.autoRetry) {
      log.info('自动重试已禁用，将会议标记为失败');
      
      for (const meeting of interruptedMeetings) {
        await markAsFailed(meeting.id, '处理中断，服务重启');
        result.failed++;
      }
      
      log.info('已将所有中断会议标记为失败', { count: result.failed });
      return result;
    }

    // Process each meeting with staggered start
    for (let i = 0; i < interruptedMeetings.length; i++) {
      const meeting = interruptedMeetings[i];

      // Check if meeting has audio file
      if (!meeting.audioPath) {
        log.warn('会议缺少音频文件，标记为失败', { meetingId: meeting.id, title: meeting.title });
        await markAsFailed(meeting.id, '缺少音频文件');
        result.failed++;
        continue;
      }

      log.info('重新处理中断的会议', { 
        meetingId: meeting.id, 
        title: meeting.title, 
        status: meeting.status 
      });

      // Stagger the start of processing
      if (i > 0 && recoveryConfig.staggerDelayMs > 0) {
        await sleep(recoveryConfig.staggerDelayMs);
      }

      // Start processing (async, don't wait for completion)
      processMeeting(meeting.id).catch(error => {
        log.error('恢复处理失败', { 
          meetingId: meeting.id, 
          error: error instanceof Error ? error.message : String(error)
        });
      });

      result.retried++;
    }

    log.info('状态恢复完成', { 
      found: result.found,
      retried: result.retried,
      failed: result.failed,
      skipped: result.skipped
    });

    return result;
  } catch (error) {
    log.error('状态恢复过程出错', { 
      error: error instanceof Error ? error.message : String(error)
    });
    return result;
  }
}

/**
 * Get recovery status for monitoring
 */
export async function getRecoveryStatus(): Promise<{
  pendingCount: number;
  meetings: Array<{ id: string; title: string; status: string; createdAt: Date }>;
}> {
  const meetings = await prisma.meeting.findMany({
    where: {
      status: { in: [...INTERRUPTED_STATES] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  });

  return {
    pendingCount: meetings.length,
    meetings,
  };
}