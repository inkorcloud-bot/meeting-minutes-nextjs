"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { MeetingCard } from "@/components/meeting-card"
import { Button } from "@/components/ui/button"
import { FileText, RefreshCw, Plus } from "lucide-react"
import Link from "next/link"
import type { MeetingListItem, MeetingListResponse } from "@/lib/types"

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error("Failed to fetch meetings")
  }
  return res.json()
}

export default function MeetingsPage() {
  // Fetch meetings with SWR - refresh every 5 seconds
  const { data, error, isLoading, mutate } = useSWR<MeetingListResponse>(
    "/api/meetings",
    fetcher,
    {
      refreshInterval: 5000, // Auto refresh every 5 seconds
      revalidateOnFocus: true,
    }
  )

  // Handle delete meeting
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/meetings/${id}`, {
          method: "DELETE",
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.message || "删除失败")
        }

        toast.success("会议已删除")

        // Revalidate the meetings list
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "删除失败，请重试")
      }
    },
    [mutate]
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">会议列表</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">加载中...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">会议列表</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive mb-4">加载失败，请检查网络连接</p>
          <Button variant="outline" onClick={() => mutate()}>
            重试
          </Button>
        </div>
      </div>
    )
  }

  const meetings = data?.data?.items ?? []
  const total = data?.data?.total ?? 0

  // Empty state
  if (meetings.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">会议列表</h1>
          <Link
            href="/upload"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
          >
            <Plus className="h-4 w-4" />
            上传会议
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-2">暂无会议记录</p>
          <p className="text-sm text-muted-foreground/70 mb-6">
            上传您的第一个会议录音，开始生成纪要
          </p>
          <Link
            href="/upload"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
          >
            <Plus className="h-4 w-4" />
            上传会议
          </Link>
        </div>
      </div>
    )
  }

  // Meetings list
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">会议列表</h1>
          <p className="text-sm text-muted-foreground mt-1">
            共 {total} 个会议
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Link
            href="/upload"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
          >
            <Plus className="h-4 w-4" />
            上传会议
          </Link>
        </div>
      </div>

      {/* Meetings Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meetings.map((meeting: MeetingListItem) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Auto-refresh hint */}
      <p className="text-xs text-muted-foreground/50 mt-8 text-center">
        列表每 5 秒自动刷新
      </p>
    </div>
  )
}