"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";

import { auth, db } from "@/lib/firebase";
import {
  getCommitmentHealth,
  type CommitmentRecord,
} from "@/lib/commitment-intelligence";

const statusTone = (label: string) => {
  if (label === "OVERDUE") {
    return "bg-rose-50 text-rose-600 border-rose-200";
  }

  if (label === "DUE SOON") {
    return "bg-amber-50 text-amber-600 border-amber-200";
  }

  if (label === "LOOSE END") {
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  }

  if (label === "COMPLETED") {
    return "bg-emerald-50 text-emerald-600 border-emerald-200";
  }

  return "bg-sky-50 text-sky-600 border-sky-200";
};

const priorityTone = (priority?: string) => {
  if (priority === "HIGH") {
    return "bg-rose-50 text-rose-600 border-rose-200";
  }

  if (priority === "LOW") {
    return "bg-sky-50 text-sky-600 border-sky-200";
  }

  return "bg-amber-50 text-amber-600 border-amber-200";
};

export default function CommitmentsPage() {
  const [commitments, setCommitments] = useState<CommitmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

      unsubscribe = onSnapshot(
        query(
          collection(db, "commitments"),
          where("userId", "==", user.uid)
        ),
        (snapshot) => {
          setCommitments(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<CommitmentRecord, "id">),
            }))
          );

          setLoading(false);
        },
        (error) => {
          console.error("ITACHI commitments error:", error);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribe?.();
    };
  }, []);

  const markComplete = async (id: string) => {
    setCompletingId(id);

    try {
      await updateDoc(doc(db, "commitments", id), {
        status: "COMPLETED",
        progress: 100,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("ITACHI completion error:", error);
      alert("Could not update this commitment. Please try again.");
    } finally {
      setCompletingId(null);
    }
  };

  const active = commitments.filter(
    (item) => item.status !== "COMPLETED"
  );

  const completed = commitments.filter(
    (item) => item.status === "COMPLETED"
  );

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
        {/* PAGE INTRO */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-600">
            Your commitments
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">
            What you said you would do.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 md:text-base">
            ITACHI keeps track of the promises, tasks, deadlines and
            responsibilities it discovers from your captures.
          </p>
        </div>

        {/* SUMMARY */}
        <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-400">Total</p>
            <p className="mt-2 text-3xl font-bold">
              {commitments.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-400">Active</p>
            <p className="mt-2 text-3xl font-bold text-purple-600">
              {active.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-400">Completed</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {completed.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-400">At risk</p>
            <p className="mt-2 text-3xl font-bold text-rose-600">
              {
                active.filter((item) => {
                  const health = getCommitmentHealth(item);

                  return (
                    health.label === "OVERDUE" ||
                    health.label === "DUE SOON"
                  );
                }).length
              }
            </p>
          </div>
        </section>

        {/* COMMITMENTS */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Active commitments
              </p>

              <h2 className="mt-2 text-xl font-bold">
                Your current workload
              </h2>
            </div>

            <Link
              href="/capture"
              className="hidden rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 md:block"
            >
              Capture new
            </Link>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400">
              Loading commitments...
            </div>
          ) : active.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <div className="text-4xl">✦</div>

              <h3 className="mt-4 text-lg font-semibold">
                No active commitments
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Capture a conversation, note, voice recording or image
                and let ITACHI discover what you need to do.
              </p>

              <Link
                href="/capture"
                className="mt-6 inline-flex rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white"
              >
                + Capture something
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {active.map((item) => {
                const health = getCommitmentHealth(item);
                const progress = Math.min(
                  100,
                  Math.max(0, item.progress ?? 0)
                );

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-5 transition hover:border-purple-200 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[#17203A]">
                            {item.title}
                          </h3>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone(
                              health.label
                            )}`}
                          >
                            {health.label}
                          </span>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${priorityTone(
                              item.priority
                            )}`}
                          >
                            {item.priority ?? "MEDIUM"}
                          </span>
                        </div>

                        <p className="mt-2 text-sm leading-relaxed text-slate-500">
                          {item.description ||
                            "No description available."}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                          <span>
                            Project: {item.project || "General"}
                          </span>

                          <span>
                            {item.deadline
                              ? `Due ${item.deadline}`
                              : "No deadline"}
                          </span>

                          <span>
                            Evidence: {item.evidenceCount ?? 0}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => markComplete(item.id)}
                        disabled={completingId === item.id}
                        className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {completingId === item.id
                          ? "Saving..."
                          : "✓ Complete"}
                      </button>
                    </div>

                    {/* PROGRESS */}
                    <div className="mt-5">
                      <div className="mb-2 flex justify-between text-xs text-slate-400">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* EVIDENCE */}
                    {item.latestEvidence && (
                      <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/60 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-500">
                          Latest evidence
                        </p>

                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                          “{item.latestEvidence}”
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* COMPLETED */}
        {completed.length > 0 && (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
              Completed
            </p>

            <h2 className="mt-2 text-xl font-bold">
              Work you finished
            </h2>

            <div className="mt-5 space-y-3">
              {completed.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-emerald-50/60 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {item.title}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {item.project || "General"}
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-emerald-600">
                    ✓ Complete
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
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
            className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-purple-600"
          >
            <span className="text-lg">✓</span>
            <span>Tasks</span>
          </Link>

          <Link
            href="/insights"
            className="flex flex-col items-center gap-1 py-3 text-xs text-slate-500"
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