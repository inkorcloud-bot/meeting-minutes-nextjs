/**
 * 统一日志工具
 * 
 * 提供结构化日志输出，支持不同日志级别和上下文信息
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 从环境变量读取日志级别，默认 info
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

/**
 * 格式化时间戳
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 格式化日志输出
 */
function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }
  
  return `${prefix} ${message}`;
}

/**
 * 日志器类
 */
class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * 创建带有固定上下文的子日志器
   */
  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const mergedContext = { ...this.context, ...context };
    const output = formatLog(level, message, mergedContext);
    
    // 使用对应的 console 方法
    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }
}

// 导出默认日志器实例
export const logger = new Logger();

// 导出日志器类，用于创建带上下文的子日志器
export { Logger };

// 便捷函数 - 用于创建模块专用日志器
export function createLogger(module: string): Logger {
  return new Logger({ module });
}