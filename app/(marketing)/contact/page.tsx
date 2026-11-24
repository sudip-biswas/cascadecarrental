"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Car, CheckCircle2, Phone } from "lucide-react";
import { Container } from "@/components/kit";
import { Button } from "@/components/ui/button";

const fieldClass =
  "flex w-full flex-col gap-0.5 rounded-[16px] bg-board px-4 py-2.5 focus-within:ring-2 focus-within:ring-ink";
const labelClass = "text-[13px] font-semibold text-slate";
const inputClass =
  "w-full bg-transparent text-base font-semibold outline-none placeholder:font-medium placeholder:text-quiet";

function ContactForm() {
  const params = useSearchParams();
  const carContext = params.get("car") ?? "";
  const fromContext = params.get("from") ?? "";
  const untilContext = params.get("until") ?? "";

  const [fields, setFields] = useState({ name: "", email: "", phone: "", message: "" });
  const [honey, setHoney] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          car: carContext || undefined,
          from: fromContext || undefined,
          until: untilContext || undefined,
          _honey: honey,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setStatus("done");
      } else {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-start gap-5 py-6">
        <span className="flex size-14 items-center justify-center rounded-[18px] bg-mint">
          <CheckCircle2 className="size-7 text-mint-ink" strokeWidth={1.75} />
        </span>
        <h1 className="headline text-[clamp(32px,4vw,52px)] leading-none">Message sent.</h1>
        <p className="max-w-[52ch] text-[17px] leading-relaxed text-slate">
          We got it and will reply to your email shortly — usually within a few hours.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/seattle">Browse cars</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="headline text-[clamp(32px,4vw,52px)] leading-none">Send us a message</h1>
        <p className="max-w-[52ch] text-[17px] leading-relaxed text-slate">
          No account needed. We reply to every message — usually within a few hours.
        </p>
        <a href="tel:+16502724085" className="flex w-fit items-center gap-2 text-[15px] font-semibold text-slate hover:text-ink">
          <Phone className="size-4" strokeWidth={1.75} />
          (650) 272-4085
        </a>
      </div>

      {/* Car context banner from car-page link */}
      {carContext && (
        <div className="flex w-full max-w-[560px] items-center gap-3 rounded-[16px] bg-board px-4 py-3">
          <Car className="size-5 shrink-0 text-slate" strokeWidth={1.75} />
          <span className="text-[14px] text-slate">
            <span className="font-semibold text-ink">{carContext}</span>
            {fromContext && untilContext && (
              <> &middot; {fromContext} → {untilContext}</>
            )}
          </span>
        </div>
      )}

      <form
        onSubmit={submit}
        className="flex w-full max-w-[560px] flex-col gap-3 rounded-[28px] bg-white p-5 sm:p-7"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={fieldClass}>
            <span className={labelClass}>Your name *</span>
            <input
              required
              value={fields.name}
              onChange={set("name")}
              placeholder="Jane Smith"
              autoComplete="name"
              className={inputClass}
            />
          </label>
          <label className={fieldClass}>
            <span className={labelClass}>Email address *</span>
            <input
              required
              type="email"
              value={fields.email}
              onChange={set("email")}
              placeholder="jane@example.com"
              autoComplete="email"
              className={inputClass}
            />
          </label>
        </div>

        <label className={fieldClass}>
          <span className={labelClass}>Phone (optional)</span>
          <input
            type="tel"
            value={fields.phone}
            onChange={set("phone")}
            placeholder="+1 (555) 000-0000"
            autoComplete="tel"
            className={inputClass}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Message *</span>
          <textarea
            required
            rows={5}
            value={fields.message}
            onChange={set("message")}
            placeholder="Ask about a car, dates, pickup, or anything else…"
            className={`${inputClass} resize-y`}
          />
        </label>

        {/* Honeypot — hidden from humans, bots fill it in */}
        <input
          aria-hidden
          tabIndex={-1}
          autoComplete="off"
          value={honey}
          onChange={(e) => setHoney(e.target.value)}
          className="absolute left-[-9999px] opacity-0"
        />

        {status === "error" && (
          <p role="alert" className="rounded-[12px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
            {errorMsg}
          </p>
        )}

        <Button type="submit" disabled={status === "loading"} className="mt-1 flex items-center gap-2 self-start">
          {status === "loading" ? "Sending…" : "Send message"}
          {status !== "loading" && <ArrowRight className="size-4" strokeWidth={2} />}
        </Button>
      </form>

      <p className="text-[14px] text-slate">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-ink hover:text-cobalt">
          Sign in
        </Link>{" "}
        to message us directly.
      </p>
    </>
  );
}

export default function ContactPage() {
  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <Suspense>
        <ContactForm />
      </Suspense>
    </Container>
  );
}
