"use client"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="font-mono text-sm bg-muted border border-border rounded-lg p-4 resize-none focus:outline-none focus:ring-2 focus:ring-primary h-full min-h-[400px] w-full text-foreground"
      placeholder="在此输入 Markdown 内容..."
    />
  )
}