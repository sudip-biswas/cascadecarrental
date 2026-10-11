"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
}

interface Trip {
  id: string;
  vehicle_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  profiles?: { full_name: string } | null;
}

interface Blocked {
  id: string;
  vehicle_id: string;
  blocked_from: string;
  blocked_to: string;
  reason: string | null;
}

interface Props {
  vehicles: Vehicle[];
  trips: Trip[];
  blocked: Blocked[];
  userId: string;
}

export function HostCalendar({ vehicles, trips, blocked }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });

  // Pad days to start on Sunday
  const startDow = start.getDay();
  const paddedDays = [
    ...Array.from({ length: startDow }, (_, i) => null),
    ...days,
  ];

  function isDayBooked(date: Date): boolean {
    return trips
      .filter((t) => selectedVehicle === "all" || t.vehicle_id === selectedVehicle)
      .some((t) => {
        try {
          return isWithinInterval(date, {
            start: parseISO(t.starts_at),
            end: parseISO(t.ends_at),
          });
        } catch {
          return false;
        }
      });
  }

  function isDayBlocked(date: Date): boolean {
    return blocked
      .filter((b) => selectedVehicle === "all" || b.vehicle_id === selectedVehicle)
      .some((b) => {
        try {
          return isWithinInterval(date, {
            start: parseISO(b.blocked_from),
            end: parseISO(b.blocked_to),
          });
        } catch {
          return false;
        }
      });
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-cascade-900 min-w-[140px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {vehicles.length > 0 && (
          <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All vehicles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vehicles</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-cascade-700" />
          Booked
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-ember-500/30 border border-ember-500/50" />
          Blocked
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-semibold text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {paddedDays.map((date, i) => {
            if (!date) {
              return <div key={`pad-${i}`} className="h-20 border-b border-r border-border/50" />;
            }

            const booked = isDayBooked(date);
            const blocked_ = isDayBlocked(date);
            const today = isSameDay(date, new Date());

            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "h-20 border-b border-r border-border/50 p-1.5 relative",
                  !isSameMonth(date, currentMonth) && "opacity-40",
                  booked && "bg-cascade-700/10",
                  blocked_ && "bg-ember-500/10"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    today && "bg-cascade-700 text-white",
                    !today && "text-cascade-900"
                  )}
                >
                  {format(date, "d")}
                </span>

                {booked && (
                  <div className="mt-1">
                    <div className="h-1.5 rounded bg-cascade-700" />
                  </div>
                )}
                {blocked_ && (
                  <div className="mt-1">
                    <div className="h-1.5 rounded bg-ember-500/60" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {vehicles.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          List your first car to start managing your calendar.
        </div>
      )}
    </div>
  );
}
