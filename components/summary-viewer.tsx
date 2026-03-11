"use client"

import { useState, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SummaryViewerProps {
  summary: string
  onCopy?: () => void
  className?: string
}

export function SummaryViewer({ summary, onCopy, className }: SummaryViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }, [summary, onCopy])

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
      <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-ul:my-4 prose-ol:my-4 prose-li:my-0.5 prose-table:overflow-hidden prose-table:rounded-lg prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            // Custom code block handling
            pre: ({ children, ...props }) => (
              <pre {...props}>{children}</pre>
            ),
            // Ensure code blocks have proper styling
            code: ({ className, children, ...props }) => {
              const isInline = !className
              if (isInline) {
                return (
                  <code className="text-sm" {...props}>
                    {children}
                  </code>
                )
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            },
          }}
        >
          {summary}
        </ReactMarkdown>
      </div>
    </div>
  )
}