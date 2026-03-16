"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  Activity,
  BrainCircuit,
  CircleAlert,
  CircleCheckBig,
  Loader2,
  RefreshCw,
  Settings2,
  Waves,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

const fetcher = async (url: string): Promise<HealthResponse> => {
  const res = await fetch(url);
  const result = (await res.json()) as HealthResponse;

  if (!res.ok || result.code !== 0) {
    throw new Error(result.message || "获取服务状态失败");
  }

  return result;
};

function getStatusMeta(status: ServiceStatus) {
  switch (status) {
    case "healthy":
      return {
        label: "正常",
        badgeVariant: "default" as const,
        icon: CircleCheckBig,
        iconClassName: "text-emerald-600",
      };
    case "degraded":
      return {
        label: "异常",
        badgeVariant: "secondary" as const,
        icon: CircleAlert,
        iconClassName: "text-amber-600",
      };
    case "not_configured":
      return {
        label: "未配置",
        badgeVariant: "outline" as const,
        icon: Settings2,
        iconClassName: "text-slate-500",
      };
    default:
      return {
        label: "不可用",
        badgeVariant: "destructive" as const,
        icon: CircleAlert,
        iconClassName: "text-destructive",
      };
  }
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatResponseTime(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${value} ms`;
}

function ServiceCard({
  service,
  icon: Icon,
}: {
  service: ServiceHealth;
  icon: typeof Waves;
}) {
  const statusMeta = getStatusMeta(service.status);
  const StatusIcon = statusMeta.icon;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-4 text-primary" />
            {service.name}
          </CardTitle>
          <CardDescription>{service.message}</CardDescription>
        </div>
        <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <StatusIcon className={cn("size-4", statusMeta.iconClassName)} />
          <span className="text-muted-foreground">最近检测：</span>
          <span>{formatDateTime(service.checkedAt)}</span>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-muted-foreground">响应时间</p>
            <p className="mt-1 font-medium">{formatResponseTime(service.responseTimeMs)}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-muted-foreground">HTTP 状态</p>
            <p className="mt-1 font-medium">{service.httpStatus ?? "-"}</p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="text-muted-foreground">探测地址</p>
          <p className="mt-1 break-all font-mono text-xs">{service.endpoint}</p>
        </div>

        {service.details && Object.keys(service.details).length > 0 ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">附加信息</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(service.details, null, 2)}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function HealthPage() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<HealthResponse>(
    "/api/health",
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );

  const overallLabel = useMemo(() => {
    const status = data?.data.overallStatus;

    if (status === "healthy") {
      return "全部正常";
    }

    if (status === "degraded") {
      return "部分异常";
    }

    if (status === "unhealthy") {
      return "服务异常";
    }

    return "检测中";
  }, [data?.data.overallStatus]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">服务健康检查</h1>
          <p className="mt-1 text-muted-foreground">正在检测 ASR 和 LLM 服务状态...</p>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">服务健康检查</h1>
          <p className="mt-1 text-muted-foreground">检测 ASR 和 LLM 服务当前可用性</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleAlert className="size-5 text-destructive" />
              状态获取失败
            </CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "请稍后重试"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => mutate()}>
              <RefreshCw className="mr-2 size-4" />
              重新检测
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">服务健康检查</h1>
          <p className="mt-1 text-muted-foreground">检测 ASR 和 LLM 服务当前可用性</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => mutate()} disabled={isValidating}>
            <RefreshCw className={cn("mr-2 size-4", isValidating && "animate-spin")} />
            刷新
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              总体状态
            </CardTitle>
            <CardDescription>
              最近一次检测时间：{formatDateTime(data.data.checkedAt)}
            </CardDescription>
          </div>
          <Badge variant={data.data.overallStatus === "healthy" ? "default" : "secondary"}>
            {overallLabel}
          </Badge>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ServiceCard service={data.data.services.asr} icon={Waves} />
        <ServiceCard service={data.data.services.llm} icon={BrainCircuit} />
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground/60">
        页面每 30 秒自动刷新一次
      </p>
    </div>
  );
}
