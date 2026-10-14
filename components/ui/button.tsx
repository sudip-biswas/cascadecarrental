import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-[14px] text-[15px] font-bold whitespace-nowrap transition-[background-color,color,transform] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:bg-line disabled:text-slate aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-graphite",
        secondary: "bg-board text-ink hover:bg-line aria-expanded:bg-line",
        outline: "bg-white text-ink hover:bg-board aria-expanded:bg-board",
        ghost: "text-ink hover:bg-board aria-expanded:bg-board",
        destructive: "bg-error-soft text-error hover:bg-[#f7d4d0]",
        link: "h-auto px-0 text-ink underline-offset-4 hover:text-cobalt hover:underline",
      },
      size: {
        default: "h-12 px-5",
        xs: "h-8 rounded-[10px] px-2.5 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-10 rounded-[12px] px-3.5 text-sm",
        lg: "h-14 rounded-[15px] px-6 text-[17px]",
        icon: "size-12",
        "icon-xs": "size-8 rounded-[10px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-10 rounded-[12px]",
        "icon-lg": "size-14 rounded-[16px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
