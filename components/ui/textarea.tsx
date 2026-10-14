import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[14px] bg-board px-4 py-3 text-base text-ink transition-colors outline-none placeholder:text-quiet focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:bg-error-soft aria-invalid:ring-2 aria-invalid:ring-error",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
