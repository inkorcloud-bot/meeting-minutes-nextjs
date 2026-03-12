/**
 * ASR Client - FireRedASR2S API 封装
 * 
 * 提供异步语音转录功能，支持任务提交、状态查询、结果获取
 */

import { config } from './config';
import { createLogger } from './logger';
import type { ASRJobStatus, TranscribeResult } from './types';

const log = createLogger('asr-client');

/**
 * ASR API 响应类型
 */
interface ASRSubmitResponse {
  job_id: string;
  message?: string;
}

interface ASRStatusResponse {
  status: ASRJobStatus;
  progress?: number;
  message?: string;
}

interface ASRResultResponse {
  result: TranscribeResult;
}

/**
 * ASR Client 错误类
 */
export class ASRClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ASRClientError';
  }
}

/**
 * FireRedASR2S API 客户端
 * 
 * 封装异步语音转录 API 调用
 * 
 * @example
 * ```typescript
 * const client = new ASRClient();
 * 
 * // 提交转录任务
 * const jobId = await client.submitJob('/path/to/audio.wav');
 * 
 * // 轮询状态
 * let status = await client.getJobStatus(jobId);
 * while (status === 'pending' || status === 'processing') {
 *   await sleep(5000);
 *   status = await client.getJobStatus(jobId);
 * }
 * 
 * // 获取结果
 * if (status === 'completed') {
 *   const result = await client.getJobResult(jobId);
 *   console.log(result.text);
 * }
 * ```
 */
export class ASRClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl?: string, timeout: number = 30000) {
    this.baseUrl = baseUrl ?? config.asrApiUrl;
    this.timeout = timeout;
  }

  /**
   * 提交异步转录任务
   * 
   * @param audioPath - 音频文件路径（服务器本地路径或 URL）
   * @returns 任务 ID
   * @throws ASRClientError 提交失败时抛出
   */
  async submitJob(audioPath: string): Promise<string> {
    const url = `${this.baseUrl}/system/transcribe/submit`;

    log.debug('提交 ASR 任务', { 
      url, 
      audioPath, 
      baseUrl: this.baseUrl,
      timeout: this.timeout 
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio_path: audioPath }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorBody = await this.safeParseError(response);
        log.error('ASR 任务提交失败', { 
          url, 
          status: response.status, 
          statusText: response.statusText,
          error: errorBody 
        });
        throw new ASRClientError(
          `Failed to submit transcription job: ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      const data = await response.json() as ASRSubmitResponse;

      if (!data.job_id) {
        log.error('ASR 响应缺少 job_id', { url, response: data });
        throw new ASRClientError(
          'Invalid response: missing job_id',
          response.status,
          data
        );
      }

      log.info('ASR 任务提交成功', { jobId: data.job_id, audioPath });
      return data.job_id;
    } catch (error) {
      if (error instanceof ASRClientError) {
        throw error;
      }
      if (error instanceof Error) {
        // 详细的网络错误日志
        const errorCode = (error as NodeJS.ErrnoException)?.code;
        log.error('ASR 网络错误', { 
          url, 
          baseUrl: this.baseUrl,
          audioPath,
          error: error.message,
          errorName: error.name,
          errorCode,
          cause: error.cause
        });
        throw new ASRClientError(
          `Network error while submitting job: ${error.message}`,
          undefined,
          error
        );
      }
      throw new ASRClientError('Unknown error while submitting job', undefined, error);
    }
  }

  /**
   * 查询任务状态
   * 
   * @param jobId - 任务 ID
   * @returns 任务状态 (pending/processing/completed/failed)
   * @throws ASRClientError 查询失败时抛出
   */
  async getJobStatus(jobId: string): Promise<ASRJobStatus> {
    const url = `${this.baseUrl}/system/transcribe/status/${encodeURIComponent(jobId)}`;

    log.debug('查询 ASR 任务状态', { jobId, url });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorBody = await this.safeParseError(response);
        log.error('查询 ASR 状态失败', { 
          jobId, 
          status: response.status, 
          statusText: response.statusText,
          error: errorBody 
        });
        throw new ASRClientError(
          `Failed to get job status: ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      const data = await response.json() as ASRStatusResponse;

      // 验证状态值
      const validStatuses: ASRJobStatus[] = ['pending', 'processing', 'completed', 'failed'];
      if (!validStatuses.includes(data.status)) {
        throw new ASRClientError(
          `Invalid job status: ${data.status}`,
          response.status,
          data
        );
      }

      return data.status;
    } catch (error) {
      if (error instanceof ASRClientError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new ASRClientError(
          `Network error while getting job status: ${error.message}`,
          undefined,
          error
        );
      }
      throw new ASRClientError('Unknown error while getting job status', undefined, error);
    }
  }

  /**
   * 获取转录结果
   * 
   * @param jobId - 任务 ID
   * @returns 转录结果
   * @throws ASRClientError 获取失败时抛出
   */
  async getJobResult(jobId: string): Promise<TranscribeResult> {
    const url = `${this.baseUrl}/system/transcribe/result/${encodeURIComponent(jobId)}`;

    log.debug('获取 ASR 转录结果', { jobId, url });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorBody = await this.safeParseError(response);
        log.error('获取 ASR 结果失败', { 
          jobId, 
          status: response.status, 
          statusText: response.statusText,
          error: errorBody 
        });
        throw new ASRClientError(
          `Failed to get job result: ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      const data = await response.json() as ASRResultResponse;

      if (!data.result) {
        log.error('ASR 响应缺少 result', { jobId, response: data });
        throw new ASRClientError(
          'Invalid response: missing result',
          response.status,
          data
        );
      }

      log.info('获取 ASR 结果成功', { 
        jobId, 
        textLength: data.result.text?.length,
        duration: data.result.dur_s 
      });
      return data.result;
    } catch (error) {
      if (error instanceof ASRClientError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new ASRClientError(
          `Network error while getting job result: ${error.message}`,
          undefined,
          error
        );
      }
      throw new ASRClientError('Unknown error while getting job result', undefined, error);
    }
  }

  /**
   * 等待任务完成并获取结果
   * 
   * 封装了轮询逻辑，自动等待任务完成后返回结果
   * 
   * @param jobId - 任务 ID
   * @param options - 轮询选项
   * @returns 转录结果
   * @throws ASRClientError 任务失败或超时时抛出
   */
  async waitForResult(
    jobId: string,
    options: {
      pollIntervalMs?: number;
      maxPolls?: number;
      onProgress?: (status: ASRJobStatus, polls: number) => void;
    } = {}
  ): Promise<TranscribeResult> {
    const {
      pollIntervalMs = config.asrPollInterval * 1000,
      maxPolls = config.asrMaxPolls,
      onProgress,
    } = options;

    let polls = 0;

    while (polls < maxPolls) {
      const status = await this.getJobStatus(jobId);
      polls++;

      onProgress?.(status, polls);

      if (status === 'completed') {
        return this.getJobResult(jobId);
      }

      if (status === 'failed') {
        throw new ASRClientError(
          `Transcription job failed: ${jobId}`,
          undefined,
          { jobId, status }
        );
      }

      // Wait before next poll
      await this.sleep(pollIntervalMs);
    }

    throw new ASRClientError(
      `Transcription job timed out after ${maxPolls} polls`,
      undefined,
      { jobId, polls }
    );
  }

  /**
   * 完整转录流程
   * 
   * 提交任务 → 等待完成 → 返回结果
   * 
   * @param audioPath - 音频文件路径
   * @param options - 轮询选项
   * @returns 转录结果
   */
  async transcribe(
    audioPath: string,
    options?: {
      pollIntervalMs?: number;
      maxPolls?: number;
      onProgress?: (status: ASRJobStatus, polls: number) => void;
    }
  ): Promise<TranscribeResult> {
    const jobId = await this.submitJob(audioPath);
    return this.waitForResult(jobId, options);
  }

  /**
   * 安全解析错误响应
   */
  private async safeParseError(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return await response.text().catch(() => 'Unable to read error body');
    }
  }

  /**
   * Sleep 工具函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 默认 ASR 客户端实例
 */
export const asrClient = new ASRClient();