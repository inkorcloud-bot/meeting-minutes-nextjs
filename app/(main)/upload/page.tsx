"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UploadForm } from "@/components/upload-form";
import type { UploadResponseData } from "@/lib/types";

export default function UploadPage() {
  const router = useRouter();

  const handleUploadSuccess = (data: UploadResponseData) => {
    toast.success("上传成功", {
      description: "会议录音已上传，正在处理中...",
    });

    // Redirect to meeting detail page (note: route is /meeting/[id], not /meetings/[id])
    router.push(`/meeting/${data.meeting_id}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">上传会议录音</h1>
        <p className="text-muted-foreground mt-1">
          上传音频文件，系统将自动转录并生成会议纪要
        </p>
      </div>

      <UploadForm onUploadSuccess={handleUploadSuccess} />
    </div>
  );
}