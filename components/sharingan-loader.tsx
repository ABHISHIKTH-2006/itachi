"use client";

export function SharinganLoader({
  label = "Loading",
}: {
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative h-16 w-16 rounded-full border-2 border-red-500/40 flex items-center justify-center animate-pulse">
        <div className="h-10 w-10 rounded-full border-2 border-red-500 flex items-center justify-center">
          <div className="h-4 w-4 rounded-full bg-red-500" />
        </div>
      </div>

      <p className="text-xs tracking-[0.25em] text-red-300/80 uppercase">
        {label}
      </p>
    </div>
  );
}