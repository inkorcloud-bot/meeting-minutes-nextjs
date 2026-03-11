import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { llmClient } from '@/lib/llm-client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

  if (!meeting.transcript) {
    return new Response(
      formatSSEError('Meeting has no transcript. Please transcribe first.'),
      {
        status: 400,
        headers: getSSEHeaders()
      }
    );
  }

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

        // Update meeting summary in database
        await prisma.meeting.update({
          where: { id },
          data: {
            summary: fullSummary,
            updatedAt: new Date()
          }
        });

        // Send completion message
        const completionData = `data: ${JSON.stringify({ done: true, summary: fullSummary })}\n\n`;
        controller.enqueue(encoder.encode(completionData));
        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate summary';
        const errorData = `data: ${JSON.stringify({ error: errorMessage })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
    
    async cancel() {
      // Handle client disconnect
      console.log(`[regenerate-summary] Client disconnected for meeting ${id}`);
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