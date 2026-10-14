import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-[14px] bg-board px-4 text-base text-ink transition-colors outline-none placeholder:text-quiet file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:bg-error-soft aria-invalid:ring-2 aria-invalid:ring-error",
        className
      )}
      {...props}
    />
  )
}

export { Input }
