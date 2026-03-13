"use client"

import { useMemo } from "react"
import { marked } from "marked"

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
})

interface SummaryViewerProps {
  summary: string
  showThinking?: boolean
  className?: string
}

/**
 * Extract thinking content and cleaned content from summary
 * Supports HTML comment format: <!-- 思考过程：... -->
 */
function extractThinkingContent(summary: string): { thinkingContent: string | null; cleanedContent: string } {
  let thinkingContent: string | null = null
  let cleaned = summary

  // Format: HTML comment <!-- 思考过程：... -->
  const htmlCommentMatch = summary.match(/<!--\s*思考过程[：:]\s*([\s\S]*?)-->/)
  if (htmlCommentMatch) {
    thinkingContent = htmlCommentMatch[1].trim()
    cleaned = summary.replace(/<!--\s*思考过程[：:][\s\S]*?-->\s*/g, "")
  }

  return { thinkingContent, cleanedContent: cleaned.trim() }
}

export function SummaryViewer({ summary, showThinking, className }: SummaryViewerProps) {
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

  return (
    <div
      className={`prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-ul:my-4 prose-ol:my-4 prose-li:my-0.5 prose-table:overflow-hidden prose-table:rounded-lg prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}