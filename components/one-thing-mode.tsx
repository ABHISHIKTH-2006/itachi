"use client";

import Link from "next/link";

type OneThingModeProps = {
  title: string;
  reason: string;
  action: string;
  priority?: string;
  status?: string;
  progress?: number;
  onComplete?: () => void;
  completing?: boolean;
};

export function OneThingMode({
  title,
  reason,
  action,
  priority = "MEDIUM",
  status = "ON TRACK",
  progress = 0,
  onComplete,
  completing = false,
}: OneThingModeProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-purple-500/25 bg-gradient-to-br from-[#160b24] via-[#0b0710] to-[#050505] p-6 md:p-10">

      {/* Ambient rings */}
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-purple-500/10" />
      <div className="absolute right-5 top-5 h-44 w-44 rounded-full border border-purple-500/10" />

      <div className="relative z-10">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-400/30 bg-purple-500/10 text-xl">
            👁️
          </div>

          <div>
            <p className="text-[10px] tracking-[0.35em] text-purple-300">
              ONE THING MODE
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Everything else can wait.
            </p>
          </div>
        </div>

        {/* Main focus */}
        <div className="mt-8 max-w-4xl">
          <p className="text-xs tracking-[0.25em] text-gray-500">
            YOUR ONE THING
          </p>

          <h2 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
            {title}
          </h2>

          <p className="mt-5 max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">
            {reason}
          </p>
        </div>

        {/* Metadata */}
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
            Priority: {priority}
          </span>

          <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-300">
            {status}
          </span>

          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-gray-300">
            Progress: {progress}%
          </span>
        </div>

        {/* Next step */}
        <div className="mt-7 max-w-3xl rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-5">
          <p className="text-[10px] tracking-[0.25em] text-purple-300">
            ⚡ DO THIS NEXT
          </p>

          <p className="mt-2 text-sm leading-relaxed text-gray-200 md:text-base">
            {action}
          </p>
        </div>

        {/* Progress */}
        <div className="mt-6 max-w-3xl">
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>FOCUS PROGRESS</span>
            <span>{progress}%</span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-purple-400 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, progress))}%`,
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-7 flex flex-wrap gap-3">

          <Link
            href="/capture"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-gray-200"
          >
            ⚡ Start Focus
          </Link>

          {onComplete && (
            <button
              onClick={onComplete}
              disabled={completing}
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-5 py-3 font-medium text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50"
            >
              {completing ? "Saving..." : "✓ Complete"}
            </button>
          )}
        </div>

      </div>
    </section>
  );
}