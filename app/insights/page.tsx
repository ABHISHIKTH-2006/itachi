"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { auth, db } from "@/lib/firebase";
import {
  getCommitmentHealth,
  type CommitmentRecord,
} from "@/lib/commitment-intelligence";

type CaptureRecord = {
  id: string;
  userId: string;
  text?: string;
  content?: string;
  transcript?: string;
  summary?: string;
  title?: string;
  createdAt?: unknown;
};

const statusTone = (label: string) => {
  if (label === "OVERDUE") {
    return "border-rose-200 bg-rose-50 text-rose-600";
  }

  if (label === "DUE SOON") {
    return "border-amber-200 bg-amber-50 text-amber-600";
  }

  if (label === "LOOSE END") {
    return "border-yellow-200 bg-yellow-50 text-yellow-700";
  }

  if (label === "COMPLETED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-600";
  }

  return "border-sky-200 bg-sky-50 text-sky-600";
};

const getCaptureText = (capture: CaptureRecord) =>
  capture.text ??
  capture.content ??
  capture.transcript ??
  capture.summary ??
  capture.title ??
  "";

export default function InsightsPage() {
  const [commitments, setCommitments] = useState<
    CommitmentRecord[]
  >([]);

  const [captures, setCaptures] = useState<CaptureRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeCommitments: (() => void) | undefined;
    let unsubscribeCaptures: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

      unsubscribeCommitments = onSnapshot(
        query(
          collection(db, "commitments"),
          where("userId", "==", user.uid)
        ),
        (snapshot) => {
          setCommitments(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<
                CommitmentRecord,
                "id"
              >),
            }))
          );

          setLoading(false);
        },
        (error) => {
          console.error(
            "ITACHI insights commitments error:",
            error
          );

          setLoading(false);
        }
      );

      unsubscribeCaptures = onSnapshot(
        query(
          collection(db, "captures"),
          where("userId", "==", user.uid)
        ),
        (snapshot) => {
          setCaptures(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<
                CaptureRecord,
                "id"
              >),
            }))
          );
        },
        (error) => {
          console.error(
            "ITACHI insights captures error:",
            error
          );
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeCommitments?.();
      unsubscribeCaptures?.();
    };
  }, []);

  const intelligence = useMemo(() => {
    const assessed = commitments.map((item) => ({
      ...item,
      health: getCommitmentHealth(item),
    }));

    const active = assessed.filter(
      (item) => item.status !== "COMPLETED"
    );

    const atRisk = active.filter(
      (item) =>
        item.health.label === "OVERDUE" ||
        item.health.label === "DUE SOON"
    );

    const looseEnds = active.filter(
      (item) => item.health.label === "LOOSE END"
    );

    const completed = assessed.filter(
      (item) => item.status === "COMPLETED"
    );

    const evidenceLogged = commitments.reduce(
      (sum, item) => sum + (item.evidenceCount ?? 0),
      0
    );

    return {
      assessed,
      active,
      atRisk,
      looseEnds,
      completed,
      evidenceLogged,
    };
  }, [commitments]);

  const recentCaptures = captures
    .slice()
    .reverse()
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-[#F6F7FF] text-[#17203A] pb-24">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
          <div>
            <Link
              href="/"
              className="text-xl font-bold tracking-[0.2em] text-purple-700"
            >
              ITACHI
            </Link>

            <p className="mt-1 text-[10px] font-medium tracking-[0.25em] text-slate-400">
              COMMITMENT INTELLIGENCE
            </p>
          </div>

          <Link
            href="/capture"
            className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition hover:scale-[1.02]"
          >
            + Capture
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">
        {/* INTRO */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-600">
            Intelligence center
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">
            See what ITACHI sees.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 md:text-base">
            ITACHI connects your commitments, evidence and captures
            to surface risks, loose ends and useful context.
          </p>
        </section>

        {/* OVERVIEW */}
        <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-400">
              Active
            </p>

            <p className="mt-2 text-3xl font-bold text-purple-600">
              {intelligence.active.length}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              commitments
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-400">
              At risk
            </p>

            <p className="mt-2 text-3xl font-bold text-rose-600">
              {intelligence.atRisk.length}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              need attention
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-400">
              Loose ends
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-600">
              {intelligence.looseEnds.length}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              without progress
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-400">
              Evidence
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {intelligence.evidenceLogged}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              linked updates
            </p>
          </div>
        </section>

        {/* RISK + LOOSE ENDS */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* AT RISK */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
                  Commitment drift
                </p>

                <h2 className="mt-2 text-xl font-bold">
                  What needs attention
                </h2>
              </div>

              <div className="rounded-xl bg-rose-50 px-3 py-2 text-lg">
                !
              </div>
            </div>

            {loading ? (
              <p className="mt-8 text-sm text-slate-400">
                Reading your commitments...
              </p>
            ) : intelligence.atRisk.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-6">
                <p className="font-semibold text-emerald-700">
                  No immediate risks.
                </p>

                <p className="mt-2 text-sm text-emerald-600">
                  ITACHI isn't currently detecting an overdue
                  or near-deadline commitment.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {intelligence.atRisk.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">
                          {item.title}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {item.health.description}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone(
                          item.health.label
                        )}`}
                      >
                        {item.health.label}
                      </span>
                    </div>

                    <p className="mt-3 text-xs font-medium text-rose-600">
                      {item.health.action}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* LOOSE ENDS */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
                  Loose end radar
                </p>

                <h2 className="mt-2 text-xl font-bold">
                  Work that may be forgotten
                </h2>
              </div>

              <div className="rounded-xl bg-amber-50 px-3 py-2 text-lg">
                ◌
              </div>
            </div>

            {loading ? (
              <p className="mt-8 text-sm text-slate-400">
                Scanning...
              </p>
            ) : intelligence.looseEnds.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-6">
                <p className="font-semibold text-emerald-700">
                  No loose ends detected.
                </p>

                <p className="mt-2 text-sm text-emerald-600">
                  Your current commitments have evidence or
                  progress attached.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {intelligence.looseEnds.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4"
                  >
                    <h3 className="font-semibold">
                      {item.title}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {item.health.reason}
                    </p>

                    <p className="mt-3 text-xs font-medium text-amber-700">
                      Next: {item.health.action}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* EVIDENCE */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                Evidence layer
              </p>

              <h2 className="mt-2 text-xl font-bold">
                Proof of progress
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                ITACHI uses captured evidence to understand whether
                work is actually moving forward.
              </p>
            </div>

            <div className="text-3xl font-bold text-emerald-600">
              {intelligence.evidenceLogged}
            </div>
          </div>

          {intelligence.assessed.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              No commitment evidence yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {intelligence.assessed
                .filter(
                  (item) => (item.evidenceCount ?? 0) > 0
                )
                .slice(0, 6)
                .map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">
                        {item.title}
                      </p>

                      <span className="text-xs font-medium text-emerald-600">
                        {item.evidenceCount ?? 0} evidence
                      </span>
                    </div>

                    {item.latestEvidence && (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500">
                        “{item.latestEvidence}”
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* CONTEXT RESURRECTION */}
        <section className="mt-8 rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-6 shadow-sm md:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-xl">
              🧠
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                Context resurrection
              </p>

              <h2 className="mt-2 text-xl font-bold">
                ITACHI remembers your captures.
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                Previous conversations, notes and captures become
                useful context when they relate to your current work.
              </p>
            </div>
          </div>

          {recentCaptures.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-purple-100 bg-white/70 p-6 text-center">
              <p className="text-sm text-slate-500">
                Capture something and ITACHI will start building
                your context history.
              </p>

              <Link
                href="/capture"
                className="mt-4 inline-flex rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
              >
                + Create a capture
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {recentCaptures.map((capture) => (
                <article
                  key={capture.id}
                  className="rounded-2xl border border-purple-100 bg-white p-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-purple-500">
                    Recent capture
                  </p>

                  {capture.title && (
                    <h3 className="mt-2 text-sm font-semibold">
                      {capture.title}
                    </h3>
                  )}

                  <p className="mt-2 line-clamp-5 text-xs leading-relaxed text-slate-500">
                    {getCaptureText(capture)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* MOBILE NAV */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 py-3 text-xs text-slate-500"
          >
            <span className="text-lg">⌂</span>
            <span>Home</span>
          </Link>

          <Link
            href="/capture"
            className="flex flex-col items-center gap-1 py-3 text-xs text-slate-500"
          >
            <span className="text-lg">＋</span>
            <span>Capture</span>
          </Link>

          <Link
            href="/commitments"
            className="flex flex-col items-center gap-1 py-3 text-xs text-slate-500"
          >
            <span className="text-lg">✓</span>
            <span>Tasks</span>
          </Link>

          <Link
            href="/insights"
            className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-purple-600"
          >
            <span className="text-lg">◉</span>
            <span>Insights</span>
          </Link>

          <Link
            href="/profile"
            className="flex flex-col items-center gap-1 py-3 text-xs text-slate-500"
          >
            <span className="text-lg">○</span>
            <span>Profile</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}