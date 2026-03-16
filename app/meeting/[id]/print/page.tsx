"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  FileText,
  Loader2,
  Printer,
} from "lucide-react"

import { SummaryViewer } from "@/components/summary-viewer"
import { Button } from "@/components/ui/button"
import type { MeetingResponseData } from "@/lib/types"

export default function MeetingPrintPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const meetingId = params.id as string
  const autoPrint = searchParams.get("autoprint") === "1"

  const [meeting, setMeeting] = useState<MeetingResponseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hasAutoPrinted = useRef(false)

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

  useEffect(() => {
    fetchMeeting()
  }, [fetchMeeting])

  useEffect(() => {
    if (meeting?.title) {
      document.title = `${meeting.title} - 会议纪要导出`
    }
  }, [meeting?.title, searchParams])

  useEffect(() => {
    if (!autoPrint || loading || !meeting || meeting.status !== "completed" || hasAutoPrinted.current) {
      return
    }

    hasAutoPrinted.current = true
    const timer = window.setTimeout(() => {
      window.print()
    }, 300)

    return () => window.clearTimeout(timer)
  }, [autoPrint, loading, meeting])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !meeting) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <FileText className="size-10 text-muted-foreground" />
        <p className="text-lg font-medium">{error || "会议不存在"}</p>
        <Link href={`/meeting/${meetingId}`}>
          <Button variant="outline">
            <ArrowLeft className="size-4 mr-2" />
            返回会议详情
          </Button>
        </Link>
      </div>
    )
  }

  if (meeting.status !== "completed") {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <FileText className="size-10 text-muted-foreground" />
        <p className="text-lg font-medium">会议尚未处理完成，暂时无法导出 PDF</p>
        <p className="text-sm text-muted-foreground">请先等待纪要生成完成后再尝试导出。</p>
        <Link href={`/meeting/${meetingId}`}>
          <Button variant="outline">
            <ArrowLeft className="size-4 mr-2" />
            返回会议详情
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">导出会议纪要</h1>
            <p className="text-sm text-muted-foreground">
              导出的 PDF 仅包含渲染后的 Markdown 正文，不含标题、时间等元信息。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4 mr-2" />
              打印 / 保存为 PDF
            </Button>

            <Link href={`/meeting/${meetingId}`}>
              <Button variant="ghost">
                <ArrowLeft className="size-4 mr-2" />
                返回详情
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:px-0 print:py-0">
        <article className="print-document rounded-2xl bg-background shadow-sm print:rounded-none print:shadow-none">
          {meeting.summary ? (
            <SummaryViewer
              summary={meeting.summary}
              className="px-6 py-6 sm:px-8 sm:py-8 print:px-0 print:py-0"
            />
          ) : (
            <div className="rounded-2xl border border-dashed bg-background p-6 text-sm text-muted-foreground print:rounded-none print:border-0 print:p-0">
              暂无会议纪要内容
            </div>
          )}
        </article>
      </main>
    </div>
  )
}
