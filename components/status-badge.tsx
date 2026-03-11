import { Badge } from "@/components/ui/badge";
import type { MeetingStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: MeetingStatus;
}

const statusConfig: Record<
  MeetingStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  uploaded: {
    label: "已上传",
    variant: "secondary",
  },
  processing: {
    label: "处理中",
    variant: "default",
    className: "bg-blue-500 text-white hover:bg-blue-600",
  },
  transcribing: {
    label: "转录中",
    variant: "default",
    className: "bg-yellow-500 text-white hover:bg-yellow-600",
  },
  summarizing: {
    label: "生成纪要",
    variant: "default",
    className: "bg-yellow-500 text-white hover:bg-yellow-600",
  },
  completed: {
    label: "已完成",
    variant: "default",
    className: "bg-green-500 text-white hover:bg-green-600",
  },
  failed: {
    label: "失败",
    variant: "destructive",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}