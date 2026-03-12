import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { llmClient } from '@/lib/llm-client';
import { getLLMSemaphore } from '@/lib/llm-semaphore';

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

  // Fetch meeting from database
  const meeting = await prisma.meeting.findUnique({
    where: { id }
  });

  if (!meeting) {
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
    return new Response(
      formatSSEError(`Cannot regenerate summary: meeting is currently in '${meeting.status}' status. Please wait for the current operation to complete.`),
      {
        status: 400,
        headers: getSSEHeaders()
      }
    );
  }

  if (!meeting.transcript) {
    return new Response(
      formatSSEError('Meeting has no transcript. Please transcribe first.'),
      {
        status: 400,
        headers: getSSEHeaders()
      }
    );
  }

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
        console.log(`[regenerate-summary] Waiting for LLM semaphore (queue: ${semaphore.getQueueLength()})`);
        await semaphore.acquire();
        console.log(`[regenerate-summary] LLM semaphore acquired (available: ${semaphore.getAvailablePermits()}/${semaphore.getMaxPermits()})`);

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

          // Update meeting summary in database with completed status
          await prisma.meeting.update({
            where: { id },
            data: {
              summary: fullSummary,
              status: 'completed',
              currentStep: null,
              progress: 100,
              error: null,
              updatedAt: new Date()
            }
          });

          // Send completion message
          const completionData = `data: ${JSON.stringify({ done: true, summary: fullSummary })}\n\n`;
          controller.enqueue(encoder.encode(completionData));
          controller.close();
        } finally {
          // Always release semaphore
          semaphore.release();
          console.log(`[regenerate-summary] LLM semaphore released (available: ${semaphore.getAvailablePermits()}/${semaphore.getMaxPermits()})`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate summary';
        
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
      console.log(`[regenerate-summary] Client disconnected for meeting ${id}`);
      
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
        console.error(`[regenerate-summary] Failed to update status on disconnect:`, dbError);
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