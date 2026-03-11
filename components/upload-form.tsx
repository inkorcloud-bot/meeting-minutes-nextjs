"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { UploadResponseData } from "@/lib/types";

interface UploadFormProps {
  onUploadSuccess?: (data: UploadResponseData) => void;
}

// Allowed audio file types
const ALLOWED_FILE_TYPES = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/webm"];
const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".webm"];

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadState {
  status: UploadStatus;
  progress: number;
  error: string | null;
}

export function UploadForm({ onUploadSuccess }: UploadFormProps) {
  // Form state
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("");
  const [attendees, setAttendees] = React.useState("");
  const [dragActive, setDragActive] = React.useState(false);
  const [uploadState, setUploadState] = React.useState<UploadState>({
    status: "idle",
    progress: 0,
    error: null,
  });

  // Validate file type
  const validateFile = (file: File): boolean => {
    const isValidType = ALLOWED_FILE_TYPES.includes(file.type);
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const isValidExtension = ALLOWED_EXTENSIONS.includes(extension);
    return isValidType || isValidExtension;
  };

  // Handle file selection
  const handleFile = (selectedFile: File) => {
    if (!validateFile(selectedFile)) {
      setUploadState({
        status: "error",
        progress: 0,
        error: `不支持的文件类型。请上传 ${ALLOWED_EXTENSIONS.join(", ")} 格式的音频文件。`,
      });
      return;
    }

    setFile(selectedFile);
    setUploadState({ status: "idle", progress: 0, error: null });

    // Auto-fill title from filename if empty
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setTitle(nameWithoutExt);
    }
  };

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // File input change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setUploadState({ status: "error", progress: 0, error: "请选择一个音频文件" });
      return;
    }

    if (!title.trim()) {
      setUploadState({ status: "error", progress: 0, error: "请输入会议标题" });
      return;
    }

    // Prepare form data
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    if (date) {
      formData.append("date", date);
    }
    if (attendees.trim()) {
      formData.append("attendees", attendees.trim());
    }

    setUploadState({ status: "uploading", progress: 0, error: null });

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message || "上传失败");
      }

      setUploadState({ status: "success", progress: 100, error: null });

      // Call success callback
      if (onUploadSuccess && result.data) {
        onUploadSuccess(result.data);
      }

      // Reset form after successful upload
      setTimeout(() => {
        setFile(null);
        setTitle("");
        setDate("");
        setAttendees("");
        setUploadState({ status: "idle", progress: 0, error: null });
      }, 1500);
    } catch (error) {
      setUploadState({
        status: "error",
        progress: 0,
        error: error instanceof Error ? error.message : "上传失败，请重试",
      });
    }
  };

  // Check if form is submittable
  const canSubmit = file && title.trim() && uploadState.status !== "uploading";

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>上传会议录音</CardTitle>
        <CardDescription>
          支持的格式: MP3, WAV, M4A, WebM
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Drop Zone */}
          <div
            className={cn(
              "relative rounded-lg border-2 border-dashed transition-colors",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50",
              uploadState.status === "error" && "border-destructive/50 bg-destructive/5"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept={ALLOWED_EXTENSIONS.join(",")}
              onChange={handleFileChange}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={uploadState.status === "uploading"}
            />
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              {file ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <svg
                      className="size-5 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                      />
                    </svg>
                    <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                    <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
                  </div>
                  {uploadState.status !== "uploading" && (
                    <p className="text-xs text-muted-foreground">
                      点击或拖拽更换文件
                    </p>
                  )}
                </>
              ) : (
                <>
                  <svg
                    className="size-10 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      拖拽文件到此处，或点击选择
                    </p>
                    <p className="text-xs text-muted-foreground">
                      MP3, WAV, M4A, WebM (最大 500MB)
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Error Message */}
          {uploadState.error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{uploadState.error}</span>
            </div>
          )}

          {/* Title Field (Required) */}
          <div className="space-y-2">
            <Label htmlFor="title">
              会议标题 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              type="text"
              placeholder="输入会议标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploadState.status === "uploading"}
              required
            />
          </div>

          {/* Date Field */}
          <div className="space-y-2">
            <Label htmlFor="date">会议日期</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={uploadState.status === "uploading"}
            />
          </div>

          {/* Attendees Field */}
          <div className="space-y-2">
            <Label htmlFor="attendees">参会人员</Label>
            <Input
              id="attendees"
              type="text"
              placeholder="多个人员用逗号分隔"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              disabled={uploadState.status === "uploading"}
            />
          </div>

          {/* Upload Progress */}
          {uploadState.status === "uploading" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">上传中...</span>
                <span className="text-muted-foreground">{uploadState.progress}%</span>
              </div>
              <Progress value={uploadState.progress} />
            </div>
          )}

          {/* Success Message */}
          {uploadState.status === "success" && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>上传成功！正在处理...</span>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit}
          >
            {uploadState.status === "uploading" ? (
              <>
                <svg
                  className="size-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>上传中...</span>
              </>
            ) : (
              "开始上传"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default UploadForm;