"use client";

import dynamic from "next/dynamic";

/** The wizard keeps a draft in localStorage, so it only renders in the browser. */
export const WizardLoader = dynamic(() => import("./WizardShell").then((m) => m.ListingWizard), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-dvh flex-col bg-board">
      <div className="h-[74px] bg-white" />
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 pt-9 sm:px-6">
        <div className="h-20 w-3/4 max-w-[560px] rounded-2xl bg-line" />
        <div className="h-6 w-1/2 max-w-[420px] rounded-lg bg-line" />
        <div className="h-48 rounded-[28px] bg-line" />
      </div>
    </div>
  ),
});
