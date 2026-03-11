/**
 * Application Configuration
 * 
 * Centralized configuration management with environment variable support
 * and sensible defaults for development.
 */

export interface Config {
  // Database
  databaseUrl: string;

  // ASR (Automatic Speech Recognition) Service
  asrApiUrl: string;
  asrPollInterval: number;  // Polling interval in seconds
  asrMaxPolls: number;      // Maximum number of polling attempts

  // LLM (Large Language Model) Service
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmTemperature: number;
  llmMaxTokens: number;
  llmConcurrency: number;   // Concurrent request limit

  // File Storage
  uploadDir: string;
  maxFileSize: number;      // Maximum file size in bytes
}

/**
 * Application configuration object
 * Values are read from environment variables with fallback defaults
 */
export const config: Config = {
  // Database configuration
  databaseUrl: process.env.DATABASE_URL || "file:./meetings.db",

  // ASR service configuration
  asrApiUrl: process.env.ASR_API_URL || "http://localhost:8000/api/v1",
  asrPollInterval: 5,
  asrMaxPolls: 720,

  // LLM service configuration
  llmBaseUrl: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
  llmApiKey: process.env.LLM_API_KEY || "",
  llmModel: "deepseek-chat",
  llmTemperature: 0.4,
  llmMaxTokens: 6000,
  llmConcurrency: 2,

  // File storage configuration
  uploadDir: "./uploads",
  maxFileSize: 524288000, // 500MB
};

/**
 * Type-safe configuration accessor
 * Use this for runtime configuration access with validation
 */
export function getConfig(): Config {
  return config;
}

/**
 * Validate required configuration
 * Throws an error if critical configuration is missing
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // LLM API key is required for LLM features
  if (!config.llmApiKey) {
    errors.push("LLM_API_KEY environment variable is not set");
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}