import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container, Tag } from "@/components/kit";
import { REVIEWS } from "@/lib/reviews";

/**
 * Guest reviews section — sourced from Turo (3,324 trips).
 *
 * Attribution: every card shows a "via Turo" tag. These are third-party
 * reviews and must NOT be marked up with Review/AggregateRating schema.
 */
export function ReviewsSection({ className }: { className?: string }) {
  return (
    <section
      className={cn("bg-board py-8 sm:py-10", className)}
      aria-label="Customer reviews"
    >
      <Container className="flex flex-col gap-6 sm:gap-8">
        {/* ── Aggregate header ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div
            role="img"
            aria-label="Rated 4.9 out of 5 stars"
            className="flex gap-1"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className="size-5 fill-amber-400 text-amber-400"
                strokeWidth={0}
              />
            ))}
          </div>
          <h2 className="headline text-[clamp(24px,3vw,40px)] leading-none">
            Rated 4.9 out of 5 by 2,900+ renters
          </h2>
          <p className="max-w-[62ch] text-sm leading-[1.5] text-slate sm:text-base">
            These reviews are from our years hosting on Turo — 3,324 trips
            completed. Same cars, same local team, now booking direct.
          </p>
        </div>

        {/* ── Review cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {REVIEWS.map((review) => (
            <article
              key={`${review.name}-${review.date}`}
              className="flex flex-col gap-3 rounded-[20px] bg-white p-5"
            >
              {/* Star row */}
              <div
                role="img"
                aria-label={`${review.rating} out of 5 stars`}
                className="flex gap-0.5"
              >
                {Array.from({ length: review.rating }, (_, i) => (
                  <Star
                    key={i}
                    className="size-4 fill-amber-400 text-amber-400"
                    strokeWidth={0}
                  />
                ))}
              </div>

              {/* Verbatim review text */}
              <p className="flex-1 text-sm leading-[1.55] text-ink">
                {review.text}
              </p>

              {/* Footer: name · date · attribution tag */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="text-sm font-extrabold text-ink">
                    {review.name}
                  </span>
                  <span className="ml-1.5 text-xs text-slate">
                    {review.date}
                  </span>
                </span>
                <Tag tone="board">via Turo</Tag>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
