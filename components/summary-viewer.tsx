"use client"

import { useState, useCallback, useMemo } from "react"
import { marked } from "marked"
import { Copy, Check, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Configure marked options
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert single line breaks to <br>
})

interface SummaryViewerProps {
  summary: string
  onCopy?: () => void
  className?: string
}

/**
 * Extract thinking content and cleaned content from summary
 * Supports three formats:
 * 1. HTML comment: <!-- 思考过程：... -->
 * 2. <think>...</think> tags (Qwen style)
 * 3. content before </think> (DeepSeek R1 style - only closing tag)
 */
function extractThinkingContent(summary: string): {
  thinkingContent: string | null
  cleanedContent: string
} {
  let thinkingContent: string | null = null
  let cleaned = summary

  // Format 1: HTML comment <!-- 思考过程：... -->
  const htmlCommentMatch = summary.match(/<!--\s*思考过程[：:]\s*([\s\S]*?)-->/)
  if (htmlCommentMatch) {
    thinkingContent = htmlCommentMatch[1].trim()
    cleaned = summary.replace(/<!--\s*思考过程[：:][\s\S]*?-->\s*/g, "")
  }

  // Format 2: <think>...</think> (Qwen style)
  if (!thinkingContent) {
    const thinkMatch = summary.match(/<think>([\s\S]*?)<\/think>/)
    if (thinkMatch) {
      thinkingContent = thinkMatch[1].trim()
      cleaned = summary.replace(/<think>[\s\S]*?<\/think>/g, "")
    }
  }

  // Format 3: content before </think> (DeepSeek R1 style)
  if (!thinkingContent) {
    const closeIdx = summary.indexOf("</think>")
    if (closeIdx !== -1) {
      const beforeThink = summary.substring(0, closeIdx)
      thinkingContent = beforeThink.trim()
      cleaned = summary.substring(closeIdx + "</think>".length)
    }
  }

  return {
    thinkingContent,
    cleanedContent: cleaned.trim()
  }
}

export function SummaryViewer({ summary, onCopy, className }: SummaryViewerProps) {
  const [copied, setCopied] = useState(false)
  const [showThinking, setShowThinking] = useState(false)

  // Extract thinking content and cleaned content
  const { thinkingContent, cleanedContent } = useMemo(() => {
    return extractThinkingContent(summary)
  }, [summary])

  // Content to display based on showThinking state
  const displayContent = showThinking && thinkingContent 
    ? `## 思考过程\n\n${thinkingContent}\n\n---\n\n## 会议纪要\n\n${cleanedContent}`
    : cleanedContent

  // HTML content for rendering
  const htmlContent = useMemo(() => {
    return marked.parse(displayContent) as string
  }, [displayContent])

  // Copy cleaned content (without thinking)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(cleanedContent)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }, [cleanedContent, onCopy])

  // If no thinking content, just show the simple viewer
  if (!thinkingContent) {
    return (
      <div className={cn("relative group", className)}>
        {/* Copy button */}
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy to clipboard"}
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>

        {/* Markdown content */}
        <div
          className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-ul:my-4 prose-ol:my-4 prose-li:my-0.5 prose-table:overflow-hidden prose-table:rounded-lg prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    )
  }

  // With thinking content - show toggle buttons
  return (
    <div className={cn("relative group", className)}>
      {/* Action buttons */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
        {/* Show thinking toggle */}
        <Button
          variant={showThinking ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowThinking(!showThinking)}
          aria-label={showThinking ? "隐藏思考过程" : "显示思考过程"}
        >
          <Brain className="size-4 mr-1.5" />
          {showThinking ? "隐藏思考" : "思考过程"}
        </Button>
        
        {/* Copy button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
        >
          {copied ? (
            <>
              <Check className="size-4 mr-1.5 text-green-500" />
              已复制
            </>
          ) : (
            <>
              <Copy className="size-4 mr-1.5" />
              复制
            </>
          )}
        </Button>
      </div>

      {/* Markdown content */}
      <div
        className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-ul:my-4 prose-ol:my-4 prose-li:my-0.5 prose-table:overflow-hidden prose-table:rounded-lg prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  )
}
