"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const WORD = "CLOSE";

function useCloseAccount() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/account/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: WORD }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "Couldn't finish closing your account. Try again.");
      setPending(false);
      return;
    }
    // The server has cleared the cookies. This clears the browser's copy too.
    await createClient().auth.signOut({ scope: "local" });
    toast.success("Your account is closed.");
    router.replace("/");
    router.refresh();
  }

  return { close, pending, error, setError };
}

function Failure({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-[15px] font-semibold text-error">
      {children}
    </p>
  );
}

/** "Close account": asks for the word first, and shows why when it's refused. */
export function CloseAccount() {
  const { close, pending, error, setError } = useCloseAccount();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");

  function toggle(next: boolean) {
    setOpen(next);
    setWord("");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="self-start">
          Close account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Close your account?</DialogTitle>
        <DialogDescription>You can&apos;t undo this. Type {WORD} to confirm.</DialogDescription>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (word === WORD) close();
          }}
        >
          <Input aria-label={`Type ${WORD}`} autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} />
          {error && <Failure>{error}</Failure>}
          <Button type="submit" disabled={word !== WORD || pending}>
            {pending ? "Closing…" : "Close account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** For a closure that stopped partway. They've already confirmed, so it's one tap. */
export function FinishClosing() {
  const { close, pending, error } = useCloseAccount();
  return (
    <>
      {error && <Failure>{error}</Failure>}
      <Button className="self-start" disabled={pending} onClick={close}>
        {pending ? "Closing…" : "Finish closing"}
      </Button>
    </>
  );
}
