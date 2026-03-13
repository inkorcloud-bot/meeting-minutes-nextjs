/**
 * LLM Client - DeepSeek API Streaming Integration
 * 
 * Encapsulates DeepSeek Chat Completions API with streaming support
 * for generating meeting summaries.
 */

import { config } from './config';

/**
 * Options for summary generation
 */
export interface SummaryOptions {
  /** Meeting title */
  title?: string;
  /** Meeting date */
  date?: string;
  /** Meeting participants */
  participants?: string;
  /** Additional instructions */
  additionalInstructions?: string;
  /** Whether to include thinking process in output */
  includeThinking?: boolean;
}

/**
 * Result of summary generation with thinking process
 */
export interface SummaryResult {
  /** Generated summary content (without thinking process) */
  summary: string;
  /** Thinking process extracted from model output */
  thinking?: string;
}

/**
 * DeepSeek API message structure
 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * DeepSeek API request structure
 */
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  extra_body?: {
    enable_thinking?: boolean;
    thinking_budget?: number;
  };
}

/**
 * DeepSeek API streaming response chunk
 */
interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }[];
}

/**
 * Extract thinking process from model output
 * Supports two formats:
 * 1. <think>...</think> tags (e.g., Qwen)
 * 2. Content before  </think> (e.g., DeepSeek R1 style)
 *
 * @param content - Raw model output
 * @returns Object with separated thinking and content
 */
export function extractThinking(content: string): { thinking: string | undefined; content: string } {
  // Format 1: <think>...</think> tags (Qwen style)
  const thinkTagMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkTagMatch) {
    const thinking = thinkTagMatch[1].trim();
    // Remove the think tag from content
    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    return { thinking, content: cleanContent };
  }

  // Format 2: Content before  </think> (DeepSeek R1 style)
  const separatorIndex = content.indexOf(' </think>');
  if (separatorIndex !== -1) {
    const thinking = content.substring(0, separatorIndex).trim();
    const cleanContent = content.substring(separatorIndex + 3).trim();
    return { thinking, content: cleanContent };
  }

  // No thinking process detected
  return { thinking: undefined, content };
}

/**
 * LLM Client for DeepSeek API
 * Provides streaming chat completions for meeting summary generation
 */
export class LLMClient {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private topP: number;
  private thinkingBudget: number;

  constructor() {
    this.baseUrl = config.llmBaseUrl;
    this.apiKey = config.llmApiKey;
    this.model = config.llmModel;
    this.temperature = config.llmTemperature;
    this.maxTokens = config.llmMaxTokens;
    this.topP = config.llmTopP;
    this.thinkingBudget = config.llmThinkingBudget;
  }

  /**
   * Build the system prompt for meeting summary generation
   */
  private buildSystemPrompt(): string {
    return `
    你是一个专业的CEO秘书，专注于整理和生成高质量的会议纪要，确保会议目标和行动计划清晰明确。要保证会议内容被全面地记录、准确地表述。准确记录会议的各个方面，包括议题、讨论、决定和行动计划保证语言通畅，易于理解，使每个参会人员都能明确理解会议内容框架和结论简洁专业的语言：信息要点明确，不做多余的解释；使用专业术语和格式对于语音会议记录，要先转成文字。然后需要你帮忙把转录出来的文本整理成没有口语、逻辑清晰、内容明确的会议纪要

## 工作流程: 
输入: 通过开场白引导用户提供会议讨论的基本信息 
整理: 遵循以下框架来整理用户提供的会议信息，每个步骤后都会进行数据校验确保信息准确性 
会议主题：会议的标题和目的。 
会议日期和时间：会议的具体日期和时间。 
参会人员：列出参加会议的所有人。 
会议记录者：注明记录这些内容的人。 
会议议程：列出会议的所有主题和讨论点。 
主要讨论：详述每个议题的讨论内容，主要包括提出的问题、提议、观点等 
决定和行动计划：列出会议的所有决定，以及计划中要采取的行动，以及负责人和计划完成日期 
下一步打算：列出下一步的计划或在未来的会议中需要讨论的问题 输出: 输出整理后的结构清晰, 描述完整的会议纪要

## 注意: 
整理会议纪要过程中, 需严格遵守信息准确性, 不对用户提供的信息做扩写仅做信息整理, 将一些明显的病句做微调 会议纪要：一份详细记录会议讨论、决定和行动计划的文档。你输出的结果将会直接写入文件并保存，所以请直接输出会议纪要，不要说其他话
因为你得到的是根据音频转录的文本，所以可能会有因为音频模糊、杂音、无关人员讲话出现错别字、无效语句、无关话语，请根据上下文语境判断并修正错误
    `;
  }

  /**
   * Build the user prompt with meeting information
   */
  private buildUserPrompt(transcript: string, options: SummaryOptions): string {
    const sections: string[] = ['已知会议信息：'];
    
    if (options.title) {
      sections.push(`会议主题：${options.title}`);
    }
    
    if (options.date) {
      sections.push(`会议日期：${options.date}`);
    }
    
    if (options.participants) {
      sections.push(`参会人员：${options.participants}`);
    } else {
      sections.push('参会人员：用户未提供，将转录文本中的醒目使用参会人员A、B、C等代替');
    }
    
    sections.push('', '会议转录内容：', transcript);
    
    if (options.additionalInstructions) {
      sections.push('', '补充说明：', options.additionalInstructions);
    }
    
    sections.push('', '以上信息为用户手动录入，可参考以上信息对转录文本进行纠正');
    
    return sections.join('\n');
  }

  /**
   * Parse SSE (Server-Sent Events) stream
   */
  private async *parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder
  ): AsyncGenerator<string> {
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Process remaining buffer
        if (buffer.trim()) {
          const content = this.extractContentFromBuffer(buffer);
          if (content) {
            yield content;
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const content = this.parseSSELine(line);
        if (content !== null) {
          yield content;
        }
      }
    }
  }

  /**
   * Parse a single SSE line and extract content
   */
  private parseSSELine(line: string): string | null {
    // Skip empty lines and comments
    if (!line.trim() || line.startsWith(':')) {
      return null;
    }

    // Handle data lines
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      
      // Check for stream end
      if (data === '[DONE]') {
        return null;
      }

      try {
        const chunk: StreamChunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          return delta.content;
        }
      } catch {
        // Invalid JSON, skip
        console.warn('Failed to parse SSE data:', data);
      }
    }

    return null;
  }

  /**
   * Extract content from remaining buffer (for stream end)
   */
  private extractContentFromBuffer(buffer: string): string | null {
    if (!buffer.trim()) {
      return null;
    }

    // Handle any remaining data line
    if (buffer.startsWith('data: ')) {
      return this.parseSSELine(buffer);
    }

    return null;
  }

  /**
   * Stream generate meeting summary
   * Yields text chunks as they arrive from the LLM
   * 
   * @param transcript - Meeting transcript text
   * @param options - Summary generation options
   * @yields Text chunks from the streaming response
   */
  async *generateSummaryStream(
    transcript: string,
    options: SummaryOptions = {}
  ): AsyncGenerator<string> {
    // Validate API key
    if (!this.apiKey) {
      throw new Error('LLM API key is not configured. Please set LLM_API_KEY environment variable.');
    }

    // Build messages
    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: this.buildUserPrompt(transcript, options) }
    ];

    // Build request
    const requestBody: ChatCompletionRequest = {
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: true,
      top_p: this.topP,
      extra_body: {
        enable_thinking: true,
        thinking_budget: this.thinkingBudget
      }
    };

    // Make streaming request
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    // Handle errors
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `LLM API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default error message
      }
      
      throw new Error(errorMessage);
    }

    // Check for streaming support
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();

    try {
      yield* this.parseSSEStream(reader, decoder);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Generate complete summary (non-streaming)
   * Collects all chunks and returns the complete result with optional thinking process
   *
   * @param transcript - Meeting transcript text
   * @param options - Summary generation options
   * @returns Complete summary result with thinking process
   */
  async generateSummary(
    transcript: string,
    options: SummaryOptions = {}
  ): Promise<SummaryResult> {
    const chunks: string[] = [];

    for await (const chunk of this.generateSummaryStream(transcript, options)) {
      chunks.push(chunk);
    }

    const rawContent = chunks.join('');
    const { thinking, content } = extractThinking(rawContent);

    return {
      summary: content,
      thinking
    };
  }

  /**
   * Generate summary with progress callback
   * Useful for tracking generation progress
   *
   * @param transcript - Meeting transcript text
   * @param options - Summary generation options
   * @param onProgress - Progress callback function (receives raw partial content)
   * @returns Complete summary result with thinking process
   */
  async generateSummaryWithProgress(
    transcript: string,
    options: SummaryOptions,
    onProgress: (partial: string) => void
  ): Promise<SummaryResult> {
    const chunks: string[] = [];

    for await (const chunk of this.generateSummaryStream(transcript, options)) {
      chunks.push(chunk);
      onProgress(chunks.join(''));
    }

    const rawContent = chunks.join('');
    const { thinking, content } = extractThinking(rawContent);

    return {
      summary: content,
      thinking
    };
  }
}

// Export singleton instance for convenience
export const llmClient = new LLMClient();