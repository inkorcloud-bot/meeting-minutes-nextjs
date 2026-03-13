import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { llmClient, extractThinking } from '@/lib/llm-client';
import { getLLMSemaphore } from '@/lib/llm-semaphore';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:regenerate-summary');

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Statuses that don't allow re-summarizing
const BLOCKED_STATUSES = ['uploaded', 'processing', 'transcribing', 'summarizing', 're-summarizing'];

/**
 * POST /api/meetings/[id]/regenerate-summary
 * 
 * Regenerates meeting summary using SSE streaming.
 * 
 * SSE Response format:
 * - Chunks: data: {"chunk": "text"}
 * - Completion: data: {"done": true, "summary": "full text"}
 * - Errors: data: {"error": "message"}
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const startTime = Date.now();

  log.info('收到重新生成摘要请求', { meetingId: id });

  // Fetch meeting from database
  const meeting = await prisma.meeting.findUnique({
    where: { id }
  });

  if (!meeting) {
    log.warn('会议不存在', { meetingId: id });
    return new Response(
      formatSSEError('Meeting not found'),
      {
        status: 404,
        headers: getSSEHeaders()
      }
    );
  }

  // Status check: reject if meeting is in a blocked status
  if (BLOCKED_STATUSES.includes(meeting.status)) {
    log.warn('会议状态不允许重新生成摘要', { meetingId: id, status: meeting.status });
    return new Response(
      formatSSEError(`Cannot regenerate summary: meeting is currently in '${meeting.status}' status. Please wait for the current operation to complete.`),
      {
        status: 400,
        headers: getSSEHeaders()
      }
    );
  }

  if (!meeting.transcript) {
    log.warn('会议没有转录文本', { meetingId: id });
    return new Response(
      formatSSEError('Meeting has no transcript. Please transcribe first.'),
      {
        status: 400,
        headers: getSSEHeaders()
      }
    );
  }

  log.info('开始重新生成摘要', { meetingId: id, title: meeting.title });

  // Update meeting status to 're-summarizing' before starting
  await prisma.meeting.update({
    where: { id },
    data: {
      status: 're-summarizing',
      currentStep: 're-summarizing',
      progress: 70,
      error: null,
      updatedAt: new Date()
    }
  });

  // Extract values for type safety in closure
  const transcript = meeting.transcript;
  const meetingTitle = meeting.title ?? undefined;
  const meetingDate = meeting.date ?? undefined;
  const meetingParticipants = meeting.participants ?? undefined;

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullSummary = '';
      const semaphore = getLLMSemaphore();

      try {
        // Acquire semaphore permit for LLM request
        log.debug('等待 LLM 信号量', { meetingId: id, queueLength: semaphore.getQueueLength() });
        await semaphore.acquire();
        log.debug('LLM 信号量已获取', { 
          meetingId: id, 
          available: semaphore.getAvailablePermits(),
          max: semaphore.getMaxPermits()
        });

        try {
          // Stream LLM response
          for await (const chunk of llmClient.generateSummaryStream(transcript, {
            title: meetingTitle,
            date: meetingDate,
            participants: meetingParticipants
          })) {
            fullSummary += chunk;
            
            // Send chunk to client
            const sseData = `data: ${JSON.stringify({ chunk })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }

          // Check if LLM returned empty content
          if (!fullSummary || fullSummary.trim() === '') {
            log.error('LLM 返回空内容', { meetingId: id });
            
            // Update status to error
            await prisma.meeting.update({
              where: { id },
              data: {
                status: 'error',
                currentStep: null,
                progress: 0,
                error: 'LLM returned empty summary content',
                updatedAt: new Date()
              }
            });

            const errorData = `data: ${JSON.stringify({ error: 'LLM returned empty summary content' })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
            return;
          }

          const duration = Date.now() - startTime;

          // Extract thinking process from full summary
          const { thinking, content: cleanSummary } = extractThinking(fullSummary);

          // Build final summary with thinking process as HTML comment (for debugging/audit)
          let finalSummary = cleanSummary;
          if (thinking) {
            finalSummary = `<!-- 思考过程：\n${thinking.replace(/-->/g, '—>')}\n-->\n\n${cleanSummary}`;
          }

          log.info('摘要生成完成', {
            meetingId: id,
            summaryLength: cleanSummary.length,
            hasThinking: !!thinking,
            thinkingLength: thinking?.length || 0,
            duration: `${duration}ms`
          });

          // Update meeting summary in database with completed status
          await prisma.meeting.update({
            where: { id },
            data: {
              summary: finalSummary,
              status: 'completed',
              currentStep: null,
              progress: 100,
              error: null,
              updatedAt: new Date()
            }
          });

          // Send completion message (with clean summary, no thinking process)
          const completionData = `data: ${JSON.stringify({ done: true, summary: cleanSummary })}\n\n`;
          controller.enqueue(encoder.encode(completionData));
          controller.close();
        } finally {
          // Always release semaphore
          semaphore.release();
          log.debug('LLM 信号量已释放', { 
            meetingId: id,
            available: semaphore.getAvailablePermits(),
            max: semaphore.getMaxPermits()
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate summary';
        const duration = Date.now() - startTime;
        
        log.error('摘要生成失败', { 
          meetingId: id, 
          error: errorMessage,
          duration: `${duration}ms`
        });
        
        // Update status to error in database
        await prisma.meeting.update({
          where: { id },
          data: {
            status: 'error',
            currentStep: null,
            progress: 0,
            error: errorMessage,
            updatedAt: new Date()
          }
        });

        const errorData = `data: ${JSON.stringify({ error: errorMessage })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
    
    async cancel() {
      // Handle client disconnect
      log.warn('客户端断开连接', { meetingId: id });
      
      // Update status to error on client disconnect
      try {
        await prisma.meeting.update({
          where: { id },
          data: {
            status: 'error',
            currentStep: null,
            progress: 0,
            error: 'Client disconnected during summary regeneration',
            updatedAt: new Date()
          }
        });
      } catch (dbError) {
        log.error('更新断连状态失败', { 
          meetingId: id,
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    }
  });

  return new Response(stream, {
    headers: getSSEHeaders()
  });
}

/**
 * Format SSE error message
 */
function formatSSEError(message: string): string {
  return `data: ${JSON.stringify({ error: message })}\n\n`;
}

/**
 * Get standard SSE response headers
 */
function getSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  };
}