"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { resendSignInLink } from "@/app/(auth)/login/actions";

export function ResendLink({ email, next }: { email: string; next: string }) {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleResend() {
    setState("loading");
    const result = await resendSignInLink(email, next);
    if (result.ok) {
      setState("sent");
    } else {
      setState("error");
      setErrorMsg(result.error ?? "Failed to send link.");
    }
  }

  if (state === "sent") {
    return (
      <p className="rounded-[14px] bg-mint px-3.5 py-3 text-[15px] font-semibold text-mint-ink">
        New link sent to {email}. Check your inbox.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {state === "error" && (
        <p className="text-[13px] text-error">{errorMsg}</p>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={state === "loading"}
        onClick={handleResend}
      >
        {state === "loading" ? "Sending…" : `Resend link to ${email}`}
      </Button>
    </div>
  );
}
