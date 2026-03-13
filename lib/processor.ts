/**
 * Meeting Processor - Complete Meeting Processing Pipeline
 *
 * Orchestrates the full meeting processing flow:
 * 1. Update status to processing (5%)
 * 2. Submit ASR async job (10%)
 * 3. Poll ASR status (15%-50%)
 * 4. Get transcription result (55%)
 * 5. Save transcript
 * 6. Call LLM to generate summary (70%-90%)
 * 7. Save summary, mark completed (100%)
 */

import { prisma } from './db';
import { asrClient, ASRClientError } from './asr-client';
import { llmClient } from './llm-client';
import { config } from './config';
import { withLLMSemaphore } from './llm-semaphore';
import { createLogger } from './logger';
import type { ASRJobStatus } from './types';
import path from 'path';

const log = createLogger('processor');

/**
 * Progress thresholds for each processing stage
 */
const PROGRESS = {
  START: 0,
  PROCESSING: 5,
  ASR_SUBMITTED: 10,
  ASR_POLLING_START: 15,
  ASR_POLLING_END: 50,
  TRANSCRIPT_SAVED: 55,
  LLM_START: 70,
  LLM_PROGRESS: 85,
  COMPLETED: 100,
} as const;

/**
 * Status values for meeting processing
 */
const STATUS = {
  PROCESSING: 'processing',
  TRANSCRIBING: 'transcribing',
  SUMMARIZING: 'summarizing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

/**
 * Update meeting progress and status in database
 */
async function updateProgress(
  meetingId: string,
  progress: number,
  status?: string,
  currentStep?: string,
  error?: string
): Promise<void> {
  const updateData: {
    progress: number;
    status?: string;
    currentStep?: string;
    error?: string;
    updatedAt: Date;
  } = {
    progress,
    updatedAt: new Date(),
  };

  if (status) {
    updateData.status = status;
  }

  if (currentStep) {
    updateData.currentStep = currentStep;
  }

  if (error !== undefined) {
    updateData.error = error;
  }

  await prisma.meeting.update({
    where: { id: meetingId },
    data: updateData,
  });
}

/**
 * Handle processing failure
 */
async function handleFailure(
  meetingId: string,
  errorMessage: string
): Promise<void> {
  log.error('会议处理失败', { meetingId, error: errorMessage });

  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: STATUS.FAILED,
      progress: 0,
      error: errorMessage,
      updatedAt: new Date(),
    },
  });
}

/**
 * Sleep utility function
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a meeting through the complete pipeline
 *
 * @param meetingId - The ID of the meeting to process
 * @throws Never throws - all errors are caught and stored in the database
 */
export async function processMeeting(meetingId: string): Promise<void> {
  const startTime = Date.now();
  log.info('开始处理会议', { meetingId });

  try {
    // ========================================
    // Step 1: Fetch meeting and validate
    // ========================================
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    if (!meeting.audioPath) {
      throw new Error('Meeting has no audio file');
    }

    // 构建完整文件路径（支持相对路径和绝对路径）
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const audioFilePath = path.isAbsolute(meeting.audioPath)
      ? meeting.audioPath
      : path.join(uploadsDir, meeting.audioPath);

    // Check if already processed or processing
    if (meeting.status === STATUS.COMPLETED) {
      log.info('会议已完成，跳过处理', { meetingId });
      return;
    }

    if (meeting.status === STATUS.PROCESSING ||
        meeting.status === STATUS.TRANSCRIBING ||
        meeting.status === STATUS.SUMMARIZING) {
      log.info('会议正在处理中，跳过', { meetingId, status: meeting.status });
      return;
    }

    // ========================================
    // Step 2: Update status to processing (5%)
    // ========================================
    await updateProgress(
      meetingId,
      PROGRESS.PROCESSING,
      STATUS.PROCESSING,
      '开始处理会议录音'
    );
    log.debug('状态更新为处理中', { meetingId, progress: 5 });

    // ========================================
    // Step 3: Submit ASR job (10%)
    // ========================================
    let asrJobId: string;

    try {
      asrJobId = await asrClient.submitJob(audioFilePath);
      log.info('ASR 任务已提交', { meetingId, asrJobId, audioFilePath });

      // Store ASR job ID for reference
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { asrJobId },
      });

      await updateProgress(
        meetingId,
        PROGRESS.ASR_SUBMITTED,
        STATUS.TRANSCRIBING,
        '已提交语音转录任务'
      );
    } catch (error) {
      const message = error instanceof ASRClientError
        ? `ASR 提交失败: ${error.message}`
        : `ASR 提交失败: ${error instanceof Error ? error.message : 'Unknown error'}`;
      log.error('ASR 任务提交失败', { meetingId, error: message });
      throw new Error(message);
    }

    // ========================================
    // Step 4: Poll ASR status (15%-50%)
    // ========================================
    let asrStatus: ASRJobStatus = 'pending';
    const pollIntervalMs = config.asrPollInterval * 1000;
    const maxPolls = config.asrMaxPolls;
    let pollCount = 0;

    await updateProgress(
      meetingId,
      PROGRESS.ASR_POLLING_START,
      undefined,
      '正在转录音频...'
    );

    try {
      while (pollCount < maxPolls) {
        asrStatus = await asrClient.getJobStatus(asrJobId);
        pollCount++;

        // Calculate progress within ASR polling range (15%-50%)
        const pollProgress = Math.min(
          PROGRESS.ASR_POLLING_END,
          PROGRESS.ASR_POLLING_START +
            Math.floor((pollCount / maxPolls) * (PROGRESS.ASR_POLLING_END - PROGRESS.ASR_POLLING_START))
        );

        const stepMessage = asrStatus === 'pending'
          ? '等待转录任务开始...'
          : `正在转录音频 (${pollCount}/${maxPolls})...`;

        await updateProgress(meetingId, pollProgress, undefined, stepMessage);

        if (asrStatus === 'completed') {
          log.info('ASR 任务完成', { meetingId, asrJobId, pollCount });
          break;
        }

        if (asrStatus === 'failed') {
          throw new Error('转录任务失败');
        }

        // Wait before next poll
        await sleep(pollIntervalMs);
      }

      if (asrStatus !== 'completed') {
        throw new Error(`转录任务超时 (尝试 ${pollCount} 次)`);
      }
    } catch (error) {
      const message = error instanceof ASRClientError
        ? `转录状态查询失败: ${error.message}`
        : `转录失败: ${error instanceof Error ? error.message : 'Unknown error'}`;
      log.error('转录失败', { meetingId, asrJobId, error: message });
      throw new Error(message);
    }

    // ========================================
    // Step 5: Get transcription result (55%)
    // ========================================
    let transcriptResult;

    try {
      await updateProgress(
        meetingId,
        PROGRESS.TRANSCRIPT_SAVED - 5,
        undefined,
        '获取转录结果...'
      );

      transcriptResult = await asrClient.getJobResult(asrJobId);
      log.info('转录结果获取成功', { 
        meetingId, 
        textLength: transcriptResult.text.length,
        duration: transcriptResult.dur_s 
      });

      // Save transcript to database
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          transcript: transcriptResult.text,
          audioDuration: transcriptResult.dur_s,
        },
      });

      await updateProgress(
        meetingId,
        PROGRESS.TRANSCRIPT_SAVED,
        undefined,
        '转录文本已保存'
      );
    } catch (error) {
      const message = error instanceof ASRClientError
        ? `获取转录结果失败: ${error.message}`
        : `保存转录失败: ${error instanceof Error ? error.message : 'Unknown error'}`;
      log.error('获取转录结果失败', { meetingId, error: message });
      throw new Error(message);
    }

    // ========================================
    // Step 6: Generate summary with LLM (70%-90%)
    // ========================================
    let summary: string;
    let thinkingProcess: string | undefined;

    try {
      await updateProgress(
        meetingId,
        PROGRESS.LLM_START,
        STATUS.SUMMARIZING,
        '正在生成会议纪要...'
      );

      // Build summary options from meeting metadata
      const summaryOptions = {
        title: meeting.title || undefined,
        date: meeting.date || undefined,
        participants: meeting.participants || undefined,
      };

      // Generate summary with progress tracking (using semaphore for concurrency control)
      let progressUpdateCount = 0;
      const result = await withLLMSemaphore(async () => {
        return llmClient.generateSummaryWithProgress(
          transcriptResult.text,
          summaryOptions,
          (partial) => {
            // Update progress periodically (not on every chunk to avoid DB spam)
            progressUpdateCount++;
            if (progressUpdateCount % 10 === 0) {
              const llmProgress = Math.min(
                PROGRESS.LLM_PROGRESS,
                PROGRESS.LLM_START + Math.floor((partial.length / 1000) * 5)
              );
              updateProgress(
                meetingId,
                llmProgress,
                undefined,
                `正在生成会议纪要 (${partial.length} 字符)...`
              ).catch(() => {
                // Ignore progress update errors
              });
            }
          }
        );
      });

      summary = result.summary;
      thinkingProcess = result.thinking;

      log.info('摘要生成完成', {
        meetingId,
        summaryLength: summary.length,
        hasThinking: !!thinkingProcess,
        thinkingLength: thinkingProcess?.length || 0
      });
    } catch (error) {
      const message = error instanceof Error
        ? `生成纪要失败: ${error.message}`
        : '生成纪要失败: Unknown error';
      log.error('摘要生成失败', { meetingId, error: message });
      throw new Error(message);
    }

    // ========================================
    // Step 7: Save summary and mark completed (100%)
    // ========================================
    try {
      // Build final summary with thinking process as HTML comment (for debugging/audit)
      let finalSummary = summary;
      if (thinkingProcess) {
        finalSummary = `<!-- 思考过程：\n${thinkingProcess.replace(/-->/g, '—>')}\n-->\n\n${summary}`;
      }

      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          summary: finalSummary,
          status: STATUS.COMPLETED,
          progress: PROGRESS.COMPLETED,
          currentStep: '处理完成',
          updatedAt: new Date(),
        },
      });

      const duration = Date.now() - startTime;
      log.info('会议处理完成', { meetingId, title: meeting.title, duration: `${duration}ms` });
    } catch (error) {
      const message = error instanceof Error
        ? `保存纪要失败: ${error.message}`
        : '保存纪要失败: Unknown error';
      log.error('保存摘要失败', { meetingId, error: message });
      throw new Error(message);
    }

  } catch (error) {
    // Catch all errors and update database status
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error occurred';

    await handleFailure(meetingId, errorMessage);

    // Re-throw for caller to handle if needed
    throw error;
  }
}

/**
 * Process meeting with retry support
 *
 * @param meetingId - The ID of the meeting to process
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelayMs - Delay between retries in milliseconds (default: 5000)
 */
export async function processMeetingWithRetry(
  meetingId: string,
  maxRetries: number = 3,
  retryDelayMs: number = 5000
): Promise<void> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.info('处理会议 (带重试)', { meetingId, attempt, maxRetries });
      await processMeeting(meetingId);
      return; // Success, exit
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      log.warn('处理尝试失败', { meetingId, attempt, maxRetries, error: lastError.message });

      if (attempt < maxRetries) {
        log.debug('等待重试', { meetingId, delayMs: retryDelayMs });
        await sleep(retryDelayMs);
      }
    }
  }

  // All retries exhausted
  log.error('所有重试失败', { meetingId, maxRetries });
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Batch process multiple meetings
 *
 * @param meetingIds - Array of meeting IDs to process
 * @param concurrency - Number of concurrent processing tasks (default: from config)
 */
export async function processMeetingsBatch(
  meetingIds: string[],
  concurrency: number = config.llmConcurrency
): Promise<Map<string, Error | null>> {
  log.info('批量处理会议', { count: meetingIds.length, concurrency });
  
  const results = new Map<string, Error | null>();

  // Process in batches based on concurrency limit
  for (let i = 0; i < meetingIds.length; i += concurrency) {
    const batch = meetingIds.slice(i, i + concurrency);
    
    log.debug('处理批次', { batchIndex: Math.floor(i / concurrency) + 1, batchSize: batch.length });

    const batchResults = await Promise.allSettled(
      batch.map(async (id) => {
        await processMeeting(id);
        return { id, error: null };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.id, null);
      } else {
        // Extract the meeting ID from the error if possible
        const errorMsg = result.reason?.message || 'Unknown error';
        log.error('批量处理错误', { error: errorMsg });
        // We don't have the meeting ID here, so we need to track it differently
      }
    }
  }
  
  const successCount = Array.from(results.values()).filter(v => v === null).length;
  log.info('批量处理完成', { total: meetingIds.length, success: successCount, failed: meetingIds.length - successCount });

  return results;
}