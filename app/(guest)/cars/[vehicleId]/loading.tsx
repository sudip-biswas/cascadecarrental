function Block({ className }: { className: string }) {
  return <div className={`animate-pulse bg-line ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 pb-16 sm:px-6 sm:pt-5">
      <Block className="-mx-4 h-[300px] rounded-b-[30px] sm:mx-0 sm:h-[420px] sm:rounded-[32px] lg:h-[510px]" />
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          <Block className="h-16 w-2/3 rounded-[16px] sm:h-20" />
          <Block className="h-5 w-1/3 rounded-[8px]" />
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-[150px] animate-pulse rounded-[22px] bg-white" />
            ))}
          </div>
          <div className="h-24 animate-pulse rounded-[24px] bg-white" />
          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="h-64 animate-pulse rounded-[26px] bg-white" />
            <div className="h-64 animate-pulse rounded-[26px] bg-white" />
          </div>
        </div>
        <div className="h-[420px] min-w-0 flex-[1_1_360px] animate-pulse rounded-[30px] bg-white" />
      </div>
    </div>
  );
}
