"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/status-badge"
import type { MeetingListItem, MeetingStatus } from "@/lib/types"
import { Trash2 } from "lucide-react"

interface MeetingCardProps {
  meeting: MeetingListItem
  onDelete?: (id: string) => void
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function MeetingCard({ meeting, onDelete }: MeetingCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDelete = () => {
    onDelete?.(meeting.id)
    setIsDeleteDialogOpen(false)
  }

  // Cast status to MeetingStatus for type safety
  const meetingStatus = meeting.status as MeetingStatus
  
  const isInProgress = 
    meetingStatus === "processing" || 
    meetingStatus === "transcribing" || 
    meetingStatus === "summarizing"

  return (
    <Link href={`/meeting/${meeting.id}`}>
      <Card className="cursor-pointer transition-colors hover:bg-muted/50">
        <CardHeader>
          <CardTitle className="line-clamp-1">{meeting.title}</CardTitle>
          <CardAction>
            <StatusBadge status={meetingStatus} />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar for in-progress meetings */}
          {isInProgress && (
            <div className="flex items-center gap-3">
              <Progress value={meeting.progress} className="flex-1">
                <ProgressTrack className="flex-1">
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
              <span className="text-xs text-muted-foreground tabular-nums">
                {meeting.progress}%
              </span>
            </div>
          )}

          {/* Meta info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(meeting.created_at)}</span>
          </div>
        </CardContent>

        {/* Delete button with confirmation dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute bottom-3 right-3 text-muted-foreground hover:text-destructive"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDeleteDialogOpen(true)
                }}
              />
            }
          >
            <Trash2 className="size-4" />
            <span className="sr-only">删除会议</span>
          </DialogTrigger>
          <DialogContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
              <DialogDescription>
                确定要删除会议「{meeting.title}」吗？此操作无法撤销。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                取消
              </DialogClose>
              <Button 
                variant="destructive" 
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  handleDelete()
                }}
              >
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </Link>
  )
}