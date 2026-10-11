"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export function HeroSearchBar() {
  const router = useRouter();
  const [where, setWhere] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  function handleSearch() {
    const params = new URLSearchParams();
    if (where) params.set("where", where);
    if (dateRange?.from) params.set("from", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to) params.set("until", format(dateRange.to, "yyyy-MM-dd"));
    router.push(`/search?${params.toString()}`);
  }

  const fromLabel = dateRange?.from ? format(dateRange.from, "MMM d") : "Add dates";
  const toLabel = dateRange?.to ? format(dateRange.to, "MMM d") : "Add dates";

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-white/20 p-2 flex flex-col sm:flex-row gap-2 max-w-3xl w-full mx-auto">
      {/* Where */}
      <div className="flex-1 flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
        <MapPin className="w-4 h-4 text-cascade-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Where
          </p>
          <Input
            type="text"
            placeholder="Airport, hotel, address, city"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            className="border-0 p-0 h-auto text-sm shadow-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="hidden sm:block w-px bg-border self-stretch" />

      {/* Date range */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex-1 flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left",
              !dateRange && "text-muted-foreground"
            )}
          >
            <Calendar className="w-4 h-4 text-cascade-500 shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                From – Until
              </p>
              <p className="text-sm text-foreground">
                {fromLabel}
                {dateRange?.from && " – "}
                {dateRange?.from ? toLabel : ""}
              </p>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="range"
            selected={dateRange}
            onSelect={setDateRange}
            disabled={{ before: new Date() }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      <Button
        onClick={handleSearch}
        className="bg-cascade-700 hover:bg-cascade-900 text-white rounded-xl px-6 shrink-0"
        size="lg"
      >
        <Search className="w-4 h-4 mr-2" />
        Search
      </Button>
    </div>
  );
}
