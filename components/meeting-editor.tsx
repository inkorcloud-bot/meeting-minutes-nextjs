"use client"

import { useState } from "react"
import { MarkdownEditor } from "./markdown-editor"
import { SummaryViewer } from "./summary-viewer"
import { Button } from "./ui/button"
import { Loader2, Save, FileText, Mic } from "lucide-react"

interface MeetingEditorProps {
  initialSummary: string
  initialTranscript?: string
  onSave: (summary: string) => Promise<void>
  isSaving?: boolean
}

export function MeetingEditor({
  initialSummary,
  initialTranscript,
  onSave,
  isSaving = false,
}: MeetingEditorProps) {
  // 状态管理
  const [content, setContent] = useState(initialSummary)
  const [activeTab, setActiveTab] = useState<"summary" | "transcript">("summary")

  // 获取当前编辑内容
  const currentContent = activeTab === "summary" ? content : (initialTranscript || "")

  // 内容变更处理
  const handleContentChange = (newContent: string) => {
    if (activeTab === "summary") {
      setContent(newContent)
    }
  }

  // 保存处理
  const handleSave = async () => {
    await onSave(content)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[400px]">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between mb-4">
        {/* Tab 切换 */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "summary"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            纪要
          </button>
          {initialTranscript && (
            <button
              onClick={() => setActiveTab("transcript")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "transcript"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mic className="h-4 w-4" />
              转录
            </button>
          )}
        </div>

        {/* 保存按钮 */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          variant="default"
          size="default"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              保存
            </>
          )}
        </Button>
      </div>

      {/* 分屏布局 */}
      <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
        {/* 左侧：编辑器 */}
        <div className="flex flex-col border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground border-b border-border">
            编辑{activeTab === "summary" ? "纪要" : "转录"}
          </div>
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor
              value={currentContent}
              onChange={handleContentChange}
            />
          </div>
        </div>

        {/* 右侧：预览 */}
        <div className="flex flex-col border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground border-b border-border">
            预览
          </div>
          <div className="flex-1 overflow-auto p-4">
            <SummaryViewer
              summary={activeTab === "summary" ? content : (initialTranscript || "")}
            />
          </div>
        </div>
      </div>
    </div>
  )
}