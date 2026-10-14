/** Shown while any hosting page loads: a title and a couple of tiles. */
export default function HostLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex animate-pulse flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="h-4 w-40 rounded-[8px] bg-line" />
        <span className="h-14 w-56 rounded-[14px] bg-line sm:h-[72px] sm:w-72" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,330px),1fr))] gap-4">
        <span className="h-72 rounded-[30px] bg-line" />
        <span className="h-72 rounded-[30px] bg-line" />
      </div>
      <span className="h-44 rounded-[30px] bg-line" />
    </div>
  );
}
