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
  className?: string
}

export function SummaryViewer({ summary, className }: SummaryViewerProps) {
  // HTML content for rendering
  const htmlContent = useMemo(() => {
    return marked.parse(summary) as string
  }, [summary])

  return (
    <div
      className={`prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-ul:my-4 prose-ol:my-4 prose-li:my-0.5 prose-table:overflow-hidden prose-table:rounded-lg prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}