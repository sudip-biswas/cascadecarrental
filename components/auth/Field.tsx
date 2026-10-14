import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends ComponentProps<"input"> {
  label: ReactNode;
  /** Shown to the right of the label, e.g. a link. */
  aside?: ReactNode;
  error?: string;
  /** Extra content under the input, inside the field. */
  children?: ReactNode;
}

/** A filled field with its label inside, as on the sign-in boards. */
export function Field({ label, aside, error, children, className, id, ...props }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn(
          "flex flex-col gap-0.5 rounded-[16px] px-3.5 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-ink",
          error ? "bg-error-soft" : "bg-board",
          className
        )}
      >
        <span className="flex justify-between text-[13px] font-semibold text-slate">
          {label}
          {aside}
        </span>
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-7 w-full bg-transparent text-[17px] text-ink outline-none placeholder:text-quiet"
          {...props}
        />
        {children}
      </label>
      {error && (
        <p id={`${id}-error`} className="px-1 text-[13px] font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Thin rule with a word in the middle. */
export function OrDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm text-slate">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Error from the server, shown above the submit button. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
      {children}
    </p>
  );
}
