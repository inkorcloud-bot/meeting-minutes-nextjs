"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  Clock, 
  RefreshCw, 
  FileText,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Brain
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import { StatusBadge } from "@/components/status-badge"
import { SummaryViewer } from "@/components/summary-viewer"
import type { MeetingResponseData, MeetingStatus } from "@/lib/types"

type ViewMode = "summary" | "transcript"

export default function MeetingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  // State
  const [meeting, setMeeting] = useState<MeetingResponseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("summary")
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regeneratingSummary, setRegeneratingSummary] = useState<string>("")
  const [showThinking, setShowThinking] = useState(false)
  const [copied, setCopied] = useState(false)

  // Extract thinking content from summary
  const extractThinkingContent = (summary: string): { thinkingContent: string | null; cleanedContent: string } => {
    let thinkingContent: string | null = null
    let cleaned = summary

    // Format 1: HTML comment <!-- 思考过程：... -->
    const htmlCommentMatch = summary.match(/<!--\s*思考过程[：:]\s*([\s\S]*?)-->/)
    if (htmlCommentMatch) {
      thinkingContent = htmlCommentMatch[1].trim()
      cleaned = summary.replace(/<!--\s*思考过程[：:][\s\S]*?-->\s*/g, "")
    }

    return { thinkingContent, cleanedContent: cleaned.trim() }
  }

  // Check if meeting is in a processing state
  const isProcessing = (status: string): boolean => {
    return status === "processing" || status === "transcribing" || status === "summarizing"
  }

  // Fetch meeting details
  const fetchMeeting = useCallback(async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}`)
      const result = await response.json()

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message || "获取会议详情失败")
      }

      setMeeting(result.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取会议详情失败")
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  // Initial fetch
  useEffect(() => {
    fetchMeeting()
  }, [fetchMeeting])

  // Polling for processing status
  useEffect(() => {
    if (!meeting || !isProcessing(meeting.status)) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/status`)
        const result = await response.json()

        if (result.code === 0 && result.data) {
          setMeeting(prev => prev ? {
            ...prev,
            status: result.data.status,
            progress: result.data.progress,
            current_step: result.data.current_step,
            error: result.data.error
          } : null)

          // Stop polling if no longer processing
          if (!isProcessing(result.data.status)) {
            // Fetch full details when processing completes
            fetchMeeting()
            
            if (result.data.status === "completed") {
              toast.success("会议处理完成")
            } else if (result.data.status === "failed") {
              toast.error("会议处理失败")
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [meeting, meetingId, fetchMeeting])

  // Regenerate summary with SSE streaming
  const handleRegenerateSummary = async () => {
    if (!meeting?.transcript) {
      toast.error("没有可用的转录内容")
      return
    }

    setIsRegenerating(true)
    setRegeneratingSummary("")

    try {
      const response = await fetch(`/api/meetings/${meetingId}/regenerate-summary`, {
        method: "POST"
      })

      if (!response.ok) {
        throw new Error("重新生成纪要失败")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("无法读取响应流")
      }

      let fullSummary = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.error) {
                throw new Error(data.error)
              }

              if (data.chunk) {
                fullSummary += data.chunk
                // Strip thinking process from streaming display
                const closeIdx = fullSummary.indexOf("</think>")
                if (closeIdx !== -1) {
                  // Thinking complete: show only content after </think>
                  setRegeneratingSummary(fullSummary.substring(closeIdx + "</think>".length).trim())
                } else if (!fullSummary.includes("<think>")) {
                  // No thinking tags detected, show content as-is
                  setRegeneratingSummary(fullSummary)
                }
                // If in thinking phase (<think> found but no </think>), keep empty → shows spinner
              }

              if (data.done) {
                // Update meeting with new summary
                setMeeting(prev => prev ? {
                  ...prev,
                  summary: data.summary
                } : null)
                toast.success("纪要重新生成完成")
              }
            } catch (parseError) {
              console.error("Parse error:", parseError)
            }
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "重新生成纪要失败")
    } finally {
      setIsRegenerating(false)
      setRegeneratingSummary("")
    }
  }

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  // Format duration
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`
    }
    return `${remainingSeconds}秒`
  }

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Error state
  if (error || !meeting) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <AlertCircle className="size-12 text-destructive" />
          <p className="text-lg font-medium">{error || "会议不存在"}</p>
          <Link href="/meetings">
            <Button>
              <ArrowLeft className="size-4 mr-2" />
              返回会议列表
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const showSummary = viewMode === "summary" && (meeting.summary || regeneratingSummary)
  const displaySummary = isRegenerating ? regeneratingSummary : meeting.summary

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back button */}
      <div className="mb-6">
        <Link href="/meetings" className="inline-flex">
          <Button variant="ghost">
            <ArrowLeft className="size-4 mr-2" />
            返回列表
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={meeting.status as MeetingStatus} />
            </div>
          </div>
        </div>

        {/* Processing progress */}
        {isProcessing(meeting.status) && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <Loader2 className="size-5 animate-spin text-primary" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {meeting.current_step || "处理中..."}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {meeting.progress}%
                    </span>
                  </div>
                  <Progress value={meeting.progress}>
                    <ProgressTrack className="flex-1">
                      <ProgressIndicator />
                    </ProgressTrack>
                  </Progress>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error message */}
        {meeting.status === "failed" && meeting.error && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">处理失败</p>
                  <p className="text-sm text-muted-foreground mt-1">{meeting.error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Meeting info */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">会议信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <Calendar className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">创建时间</p>
                <p className="font-medium">{formatDate(meeting.created_at)}</p>
              </div>
            </div>

            {meeting.audio_duration && (
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">音频时长</p>
                  <p className="font-medium">{formatDuration(meeting.audio_duration)}</p>
                </div>
              </div>
            )}

            {meeting.updated_at && (
              <div className="flex items-center gap-3">
                <FileText className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">最后更新</p>
                  <p className="font-medium">{formatDate(meeting.updated_at)}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content section */}
      {meeting.status === "completed" && (
        <div className="space-y-4">
          {/* View toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "summary" ? "secondary" : "ghost"}
                onClick={() => setViewMode("summary")}
              >
                <FileText className="size-4 mr-2" />
                会议纪要
              </Button>
              <Button
                variant={viewMode === "transcript" ? "secondary" : "ghost"}
                onClick={() => setViewMode("transcript")}
              >
                原始转录
              </Button>
            </div>

            {viewMode === "summary" && meeting.transcript && (
              <div className="flex items-center gap-2">
                {/* Thinking toggle button */}
                {displaySummary && extractThinkingContent(displaySummary).thinkingContent && (
                  <Button
                    variant={showThinking ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setShowThinking(!showThinking)}
                  >
                    <Brain className="size-4 mr-2" />
                    {showThinking ? "隐藏思考" : "思考过程"}
                  </Button>
                )}
                
                {/* Copy button */}
                {displaySummary && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const { cleanedContent } = extractThinkingContent(displaySummary)
                      await navigator.clipboard.writeText(cleanedContent)
                      setCopied(true)
                      toast.success("已复制到剪贴板")
                      setTimeout(() => setCopied(false), 2000)
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="size-4 mr-2 text-green-500" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="size-4 mr-2" />
                        复制
                      </>
                    )}
                  </Button>
                )}
                
                {/* Regenerate button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateSummary}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4 mr-2" />
                      重新生成
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Summary view */}
          {viewMode === "summary" && (
            <Card>
              <CardContent className="pt-6">
                {showSummary ? (
                  <SummaryViewer 
                    summary={displaySummary || ""} 
                    showThinking={showThinking}
                  />
                ) : isRegenerating ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="size-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">暂无会议纪要</p>
                    {meeting.transcript && (
                      <Button onClick={handleRegenerateSummary}>
                        <RefreshCw className="size-4 mr-2" />
                        生成纪要
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Transcript view */}
          {viewMode === "transcript" && (
            <Card>
              <CardContent className="pt-6">
                {meeting.transcript ? (
                  <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto text-foreground">
                      {meeting.transcript}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="size-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">暂无转录内容</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Waiting state for non-completed meetings */}
      {meeting.status !== "completed" && meeting.status !== "failed" && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Loader2 className="size-12 text-muted-foreground mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">
                会议正在处理中，请稍候...
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                页面将自动刷新
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}