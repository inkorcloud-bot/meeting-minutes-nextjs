import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:health");

type ServiceStatus = "healthy" | "degraded" | "unhealthy" | "not_configured";

interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  endpoint: string;
  message: string;
  checkedAt: string;
  responseTimeMs: number | null;
  httpStatus?: number;
  details?: Record<string, unknown>;
}

interface HealthResponse {
  code: number;
  message: string;
  data: {
    overallStatus: "healthy" | "degraded" | "unhealthy";
    checkedAt: string;
    services: {
      asr: ServiceHealth;
      llm: ServiceHealth;
    };
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function safeParseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

function deriveOverallStatus(statuses: ServiceStatus[]): "healthy" | "degraded" | "unhealthy" {
  if (statuses.every((status) => status === "healthy")) {
    return "healthy";
  }

  if (statuses.some((status) => status === "unhealthy")) {
    return "unhealthy";
  }

  return "degraded";
}

async function checkAsrHealth(): Promise<ServiceHealth> {
  const endpoint = `${trimTrailingSlash(config.asrApiUrl)}/health`;
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    const responseTimeMs = Date.now() - startedAt;
    const body = await safeParseBody(response);
    const checkedAt = new Date().toISOString();

    if (!response.ok) {
      return {
        name: "ASR",
        status: "unhealthy",
        endpoint,
        message: `健康检查失败：HTTP ${response.status}`,
        checkedAt,
        responseTimeMs,
        httpStatus: response.status,
        details: body ? { response: body } : undefined,
      };
    }

    const payload = body as {
      code?: number;
      message?: string;
      data?: {
        status?: string;
        version?: string;
        models_loaded?: boolean;
      };
    } | null;

    const serviceHealthy =
      payload?.code === 0 &&
      payload?.data?.status === "healthy" &&
      payload?.data?.models_loaded !== false;

    return {
      name: "ASR",
      status: serviceHealthy ? "healthy" : "degraded",
      endpoint,
      message: serviceHealthy
        ? "ASR 服务可用"
        : payload?.message || "ASR 服务返回了异常状态",
      checkedAt,
      responseTimeMs,
      httpStatus: response.status,
      details: payload?.data
        ? {
            serviceStatus: payload.data.status,
            version: payload.data.version,
            modelsLoaded: payload.data.models_loaded,
          }
        : undefined,
    };
  } catch (error) {
    return {
      name: "ASR",
      status: "unhealthy",
      endpoint,
      message: `请求失败：${safeErrorMessage(error)}`,
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
    };
  }
}

async function checkLlmHealth(): Promise<ServiceHealth> {
  const endpoint = `${trimTrailingSlash(config.llmBaseUrl)}/models`;

  if (!config.llmApiKey) {
    return {
      name: "LLM",
      status: "not_configured",
      endpoint,
      message: "未配置 LLM_API_KEY",
      checkedAt: new Date().toISOString(),
      responseTimeMs: null,
    };
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.llmApiKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    const responseTimeMs = Date.now() - startedAt;
    const body = await safeParseBody(response);
    const checkedAt = new Date().toISOString();

    if (!response.ok) {
      const status: ServiceStatus =
        response.status === 401 || response.status === 403 ? "degraded" : "unhealthy";

      return {
        name: "LLM",
        status,
        endpoint,
        message:
          response.status === 401 || response.status === 403
            ? `服务可达，但鉴权失败：HTTP ${response.status}`
            : `模型列表请求失败：HTTP ${response.status}`,
        checkedAt,
        responseTimeMs,
        httpStatus: response.status,
        details: body ? { response: body } : undefined,
      };
    }

    const payload = body as { data?: Array<{ id?: string }> } | null;
    const modelCount = Array.isArray(payload?.data) ? payload.data.length : undefined;

    return {
      name: "LLM",
      status: "healthy",
      endpoint,
      message:
        typeof modelCount === "number"
          ? `LLM 服务可用，已发现 ${modelCount} 个模型`
          : "LLM 服务可用",
      checkedAt,
      responseTimeMs,
      httpStatus: response.status,
      details: {
        model: config.llmModel,
        modelCount,
      },
    };
  } catch (error) {
    return {
      name: "LLM",
      status: "unhealthy",
      endpoint,
      message: `请求失败：${safeErrorMessage(error)}`,
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      details: {
        model: config.llmModel,
      },
    };
  }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const startedAt = Date.now();

  try {
    const [asr, llm] = await Promise.all([checkAsrHealth(), checkLlmHealth()]);
    const checkedAt = new Date().toISOString();
    const overallStatus = deriveOverallStatus([asr.status, llm.status]);

    log.info("服务健康检查完成", {
      overallStatus,
      duration: `${Date.now() - startedAt}ms`,
      asrStatus: asr.status,
      llmStatus: llm.status,
    });

    return NextResponse.json({
      code: 0,
      message: "success",
      data: {
        overallStatus,
        checkedAt,
        services: {
          asr,
          llm,
        },
      },
    });
  } catch (error) {
    log.error("服务健康检查失败", {
      error: safeErrorMessage(error),
      duration: `${Date.now() - startedAt}ms`,
    });

    return NextResponse.json(
      {
        code: 500,
        message: "服务健康检查失败",
        data: {
          overallStatus: "unhealthy",
          checkedAt: new Date().toISOString(),
          services: {
            asr: {
              name: "ASR",
              status: "unhealthy",
              endpoint: `${trimTrailingSlash(config.asrApiUrl)}/health`,
              message: "健康检查过程中发生异常",
              checkedAt: new Date().toISOString(),
              responseTimeMs: null,
            },
            llm: {
              name: "LLM",
              status: "unhealthy",
              endpoint: `${trimTrailingSlash(config.llmBaseUrl)}/models`,
              message: "健康检查过程中发生异常",
              checkedAt: new Date().toISOString(),
              responseTimeMs: null,
            },
          },
        },
      },
      { status: 500 }
    );
  }
}
