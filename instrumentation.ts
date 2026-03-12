/**
 * Next.js Instrumentation Hook
 *
 * This file runs when the Next.js server starts.
 * Used for initialization tasks like:
 * - Recovering interrupted meeting processing
 * - Initializing connections
 * - Setting up background jobs
 *
 * Note: Prisma doesn't support Edge Runtime, so we only run in nodejs runtime.
 */

export async function register() {
  // Only run in Node.js runtime (not Edge Runtime)
  // Prisma requires Node.js runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to ensure code only loads in Node.js runtime
    const { runRecovery } = await import('./lib/recovery');
    const { createLogger } = await import('./lib/logger');
    
    const log = createLogger('instrumentation');
    log.info('服务启动，开始初始化...');
    
    const startTime = Date.now();

    try {
      // Run recovery for interrupted meetings
      // Delay slightly to ensure database connection is ready
      setTimeout(async () => {
        try {
          const result = await runRecovery({
            autoRetry: true,
            maxAgeHours: 24,
            staggerDelayMs: 3000,
          });
          
          const duration = Date.now() - startTime;
          log.info('初始化完成', { 
            duration: `${duration}ms`,
            recovery: result
          });
        } catch (error) {
          log.error('状态恢复失败', { 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }, 1000);
      
    } catch (error) {
      log.error('初始化失败', { 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}