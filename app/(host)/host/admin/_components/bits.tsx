import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Row of filter links; the current one is filled. */
export function FilterLinks({ options, current }: { options: { href: string; label: string; value: string }[]; current: string }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          aria-current={o.value === current ? "page" : undefined}
          className={cn(
            "rounded-[12px] px-3.5 py-2 text-[14px] font-bold",
            o.value === current ? "bg-ink text-white" : "bg-white text-ink hover:bg-board"
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

/** Plain GET search box: the query lands in ?q= so results are linkable. */
export function SearchBox({ action, q, placeholder }: { action: string; q: string; placeholder: string }) {
  return (
    <form action={action} className="flex gap-2">
      <Input name="q" defaultValue={q} placeholder={placeholder} aria-label="Search" className="bg-white" />
      <Button type="submit" className="shrink-0">
        <Search />
        Search
      </Button>
    </form>
  );
}

/** Evidence photos: signed links open full size in a new tab. */
export function Photos({ paths, urls }: { paths: string[]; urls: Record<string, string> }) {
  if (!paths.length) return <p className="text-[14px] text-slate">No photos.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {paths.map((path) =>
        urls[path] ? (
          <a key={path} href={urls[path]} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed links, nothing to optimize */}
            <img src={urls[path]} alt="" className="size-24 rounded-[12px] bg-board object-cover" />
          </a>
        ) : (
          <span key={path} className="flex size-24 items-center justify-center rounded-[12px] bg-board text-center text-[12px] text-slate">
            Missing
          </span>
        )
      )}
    </div>
  );
}
