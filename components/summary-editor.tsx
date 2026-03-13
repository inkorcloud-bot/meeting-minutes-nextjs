"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

interface SummaryEditorProps {
  summary: string
  onSave: (summary: string) => Promise<void>
  onCancel: () => void
}

export function SummaryEditor({ summary, onSave, onCancel }: SummaryEditorProps) {
  const [editedSummary, setEditedSummary] = useState(summary)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!editedSummary.trim()) {
      toast.error("纪要内容不能为空")
      return
    }

    setIsSaving(true)
    try {
      await onSave(editedSummary)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <textarea
        value={editedSummary}
        onChange={(e) => setEditedSummary(e.target.value)}
        className="w-full min-h-[400px] p-4 text-sm border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="输入会议纪要内容..."
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          取消
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || editedSummary === summary}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="size-4 mr-2" />
              保存
            </>
          )}
        </Button>
      </div>
    </div>
  )
}