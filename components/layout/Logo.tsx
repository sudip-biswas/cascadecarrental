import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: Props) {
  const sizes = {
    sm: { icon: "w-6 h-6", text: "text-base" },
    md: { icon: "w-8 h-8", text: "text-xl" },
    lg: { icon: "w-10 h-10", text: "text-2xl" },
  };

  return (
    <Link href="/" className={cn("flex items-center gap-2 shrink-0", className)}>
      <div
        className={cn(
          "bg-cascade-700 rounded-md flex items-center justify-center",
          sizes[size].icon
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-4/6 h-4/6 text-white"
          aria-hidden="true"
        >
          <path
            d="M3 17H21M5 17V10L12 5L19 10V17M9 17V13H15V17"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span
        className={cn("font-bold text-cascade-900 tracking-tight", sizes[size].text)}
      >
        Cascade
      </span>
    </Link>
  );
}
