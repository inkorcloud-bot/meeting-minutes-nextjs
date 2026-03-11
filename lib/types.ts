/**
 * API Response Types
 * 类型定义文件 - 与前端类型兼容
 */

// ============================================
// 基础响应类型
// ============================================

/**
 * 基础响应
 * @property code - 状态码，0 表示成功
 * @property message - 响应消息
 */
export interface BaseResponse {
  code: number; // 0 = 成功
  message: string;
}

/**
 * 通用数据响应
 * @template T - 数据类型
 */
export interface DataResponse<T> extends BaseResponse {
  data?: T;
}

// ============================================
// 会议相关类型
// ============================================

/**
 * 会议状态枚举
 */
export type MeetingStatus =
  | "uploaded"
  | "processing"
  | "transcribing"
  | "summarizing"
  | "completed"
  | "failed";

/**
 * ASR 任务状态
 */
export type ASRJobStatus = "pending" | "processing" | "completed" | "failed";

/**
 * 上传响应数据
 */
export interface UploadResponseData {
  meeting_id: string;
  status: string;
  estimated_processing_time?: string;
}

/**
 * 状态查询响应数据
 */
export interface StatusResponseData {
  meeting_id: string;
  status: string;
  progress: number;
  current_step?: string;
  error?: string;
}

/**
 * 会议详情数据
 */
export interface MeetingResponseData {
  id: string;
  title: string;
  status: string;
  audio_path?: string;
  audio_duration?: number;
  transcript?: string;
  summary?: string;
  progress: number;
  current_step?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 会议列表项
 */
export interface MeetingListItem {
  id: string;
  title: string;
  status: string;
  progress: number;
  created_at: string;
}

/**
 * 会议列表响应数据
 */
export interface MeetingListResponseData {
  total: number;
  items: MeetingListItem[];
}

// ============================================
// ASR 转录相关类型
// ============================================

/**
 * ASR 句子片段
 */
export interface TranscribeSentence {
  text: string;
  start: number;
  end: number;
}

/**
 * ASR 词汇片段
 */
export interface TranscribeWord {
  word: string;
  start: number;
  end: number;
}

/**
 * ASR 转录结果
 */
export interface TranscribeResult {
  uttid: string;
  text: string;
  dur_s: number;
  sentences?: TranscribeSentence[];
  words?: TranscribeWord[];
}

// ============================================
// API 响应类型别名（方便使用）
// ============================================

/**
 * 上传接口响应
 */
export type UploadResponse = DataResponse<UploadResponseData>;

/**
 * 状态查询响应
 */
export type StatusResponse = DataResponse<StatusResponseData>;

/**
 * 会议详情响应
 */
export type MeetingResponse = DataResponse<MeetingResponseData>;

/**
 * 会议列表响应
 */
export type MeetingListResponse = DataResponse<MeetingListResponseData>;

// ============================================
// 工具类型
// ============================================

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * 排序参数
 */
export interface SortParams {
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

/**
 * 会议查询参数
 */
export interface MeetingQueryParams extends PaginationParams, SortParams {
  status?: MeetingStatus;
  search?: string;
}