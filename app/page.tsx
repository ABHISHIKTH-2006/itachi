"use client";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  getCommitmentHealth,
  getNextBestAction,
  type CommitmentRecord,
} from "@/lib/commitment-intelligence";
import { SharinganLoader } from "../components/sharingan-loader";
import { OneThingMode } from "../components/one-thing-mode";
const toneFor = (label: string) => {
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
    return "text-rose-600 bg-rose-50 border-rose-200";
  }
  if (priority === "LOW") {
    return "text-sky-600 bg-sky-50 border-sky-200";
  }
  return "text-amber-600 bg-amber-50 border-amber-200";
};
/* =========================================================
   CONTEXT RESURRECTION
   ========================================================= */
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
const CONTEXT_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "been",
  "before",
  "but",
  "can",
  "did",
  "for",
  "from",
  "have",
  "into",
  "is",
  "it",
  "just",
  "my",
  "need",
  "next",
  "of",
  "on",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "will",
  "with",
  "work",
  "you",
  "your",
]);
function contextKeywords(text: string) {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter(
        (word) =>
          word.length > 2 &&
          !CONTEXT_STOP_WORDS.has(word)
      ) ?? []
  );
}
function getCaptureText(capture: CaptureRecord) {
  return (
    capture.text ??
    capture.content ??
    capture.transcript ??
    capture.summary ??
    capture.title ??
    ""
  );
}
function findRelatedCaptures(
  commitment: CommitmentRecord | null,
  captures: CaptureRecord[]
) {
  if (!commitment) return [];
  const commitmentText = [
    commitment.title,
    commitment.description ?? "",
    commitment.project ?? "",
  ].join(" ");
  const commitmentWords = contextKeywords(commitmentText);
  if (commitmentWords.size === 0) return [];
  return captures
    .map((capture) => {
      const captureText = getCaptureText(capture);
      if (!captureText.trim()) {
        return {
          capture,
          score: 0,
          text: "",
        };
      }
      const captureWords = contextKeywords(captureText);
      const matchingWords = [
        ...captureWords,
      ].filter((word) =>
        commitmentWords.has(word)
      );
      return {
        capture,
        score: matchingWords.length,
        text: captureText,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
export default function Home() {
  const router = useRouter();
  const [commitments, setCommitments] =
    useState<CommitmentRecord[]>([]);
  const [captures, setCaptures] =
    useState<CaptureRecord[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [completingId, setCompletingId] =
    useState<string | null>(null);
  /* =========================================================
     FIREBASE LISTENERS
     ========================================================= */
  useEffect(() => {
    let unsubscribeCommitments:
      | (() => void)
      | undefined;
    let unsubscribeCaptures:
      | (() => void)
      | undefined;
    const unsubscribeAuth =
      onAuthStateChanged(auth, (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        /* -------------------------
           COMMITMENTS
        ------------------------- */
        unsubscribeCommitments =
          onSnapshot(
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
                "ITACHI commitments error:",
                error
              );
              setLoading(false);
            }
          );
        /* -------------------------
           CAPTURES
        ------------------------- */
        unsubscribeCaptures =
          onSnapshot(
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
                "ITACHI captures error:",
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
  }, [router]);
  /* =========================================================
     INTELLIGENCE ENGINE
     ========================================================= */
  const intelligence = useMemo(() => {
    const active = commitments.filter(
      (item) =>
        item.status !== "COMPLETED"
    );
    const assessed = active.map((item) => ({
      ...item,
      health: getCommitmentHealth(item),
    }));
    const atRisk = assessed.filter(
      (item) =>
        item.health.label === "OVERDUE" ||
        item.health.label === "DUE SOON"
    );
    const looseEnds = assessed.filter(
      (item) =>
        item.health.label === "LOOSE END"
    );
    const nextAction =
      getNextBestAction(commitments);
    const evidenceLogged =
      commitments.reduce(
        (sum, item) =>
          sum + (item.evidenceCount ?? 0),
        0
      );
    /* =====================================================
       CONTEXT RESURRECTION
       ===================================================== */
    const contextForNextAction =
      findRelatedCaptures(
        nextAction,
        captures
      );
    return {
      active,
      assessed,
      atRisk,
      looseEnds,
      nextAction,
      evidenceLogged,
      contextForNextAction,
    };
  }, [commitments, captures]);
  /* =========================================================
     MARK COMPLETE
     ========================================================= */
  const markComplete = async (
    commitmentId: string
  ) => {
    setCompletingId(commitmentId);
    try {
      await updateDoc(
        doc(
          db,
          "commitments",
          commitmentId
        ),
        {
          status: "COMPLETED",
          progress: 100,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error(
        "ITACHI completion error:",
        error
      );
      alert(
        "Could not update this commitment. Please try again."
      );
    } finally {
      setCompletingId(null);
    }
  };
  <section className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-[#160b24] via-[#0b0710] to-[#050505] p-6 md:p-10">
  <div className="relative z-10">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-400/30 bg-purple-500/10">
        👁️
      </div>
      <div>
        <p className="text-[10px] tracking-[0.35em] text-purple-300">
          YOUR ONE THING
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Everything else can wait.
        </p>
      </div>
    </div>
    <h2 className="mt-8 text-3xl font-semibold leading-tight md:text-5xl">
      {intelligence?.assessed?.[0]?.title ?? "You're clear for now."}
    </h2>
    <p className="mt-5 max-w-3xl text-gray-400">
     {intelligence?.assessed?.[0]?.health?.reason ??
  "Capture something and ITACHI will identify what deserves your attention."}
    </p>
    {/* status + progress */}
    {/* do this next */}
    {/* actions */}
  </div>
</section>
 return (
  <main className="min-h-screen bg-[#F6F7FF] text-[#17203A] pb-24">

    {/* =========================================================
        DESKTOP HEADER
    ========================================================= */}
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-10">

        <Link href="/" className="group">
          <h1 className="text-xl font-bold tracking-[0.22em] text-purple-700">
            ITACHI
          </h1>

          <p className="mt-0.5 text-[9px] font-medium tracking-[0.25em] text-slate-400">
            COMMITMENT INTELLIGENCE
          </p>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">

          <Link
            href="/"
            className="rounded-xl bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700"
          >
            Home
          </Link>

          <Link
            href="/capture"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            Capture
          </Link>

          <Link
            href="/commitments"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            Commitments
          </Link>

          <Link
            href="/insights"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            Insights
          </Link>

          <Link
            href="/profile"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            Profile
          </Link>
        </nav>

        <Link
          href="/capture"
          className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition hover:scale-[1.02]"
        >
          + Capture
        </Link>

      </div>
    </header>


    {/* =========================================================
        MAIN CONTENT
    ========================================================= */}
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">

      {/* =======================================================
          WELCOME
      ======================================================= */}
      <section className="mb-8">

        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-600">
          Your command center
        </p>

        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">

          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
              What matters right now?
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 md:text-base">
              ITACHI connects what you promised, what you captured,
              and what you've actually done.
            </p>
          </div>

          <Link
            href="/capture"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-purple-200 bg-white px-5 py-3 text-sm font-semibold text-purple-700 shadow-sm transition hover:border-purple-300 hover:bg-purple-50"
          >
            ✦ Capture anything
          </Link>

        </div>
      </section>


      {/* =======================================================
          ONE THING
      ======================================================= */}
      <section className="relative overflow-hidden rounded-[2rem] border border-purple-200 bg-gradient-to-br from-[#6D28D9] via-[#7C3AED] to-[#8B5CF6] p-6 text-white shadow-xl shadow-purple-200/60 md:p-10">

        {/* decorative circles */}
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full border border-white/10" />
        <div className="absolute bottom-[-80px] left-[-80px] h-56 w-56 rounded-full bg-white/5 blur-3xl" />

        <div className="relative z-10">

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-xl backdrop-blur">
              ⚡
            </div>

            <div>
              <p className="text-[10px] font-semibold tracking-[0.3em] text-purple-100">
                YOUR ONE THING
              </p>

              <p className="mt-1 text-xs text-purple-100/70">
                Everything else can wait.
              </p>
            </div>
          </div>


          {loading ? (

            <div className="mt-8">
              <h3 className="text-2xl font-semibold md:text-4xl">
                Reading your commitments...
              </h3>

              <p className="mt-3 text-sm text-purple-100/70">
                ITACHI is figuring out what deserves your attention.
              </p>
            </div>

          ) : intelligence.nextAction ? (

            <div className="mt-8">

              <p className="text-xs font-medium uppercase tracking-[0.2em] text-purple-100/70">
                Focus on
              </p>

              <h3 className="mt-3 max-w-4xl text-3xl font-bold leading-tight md:text-5xl">
                {intelligence.nextAction.title}
              </h3>

              <p className="mt-5 max-w-3xl text-sm leading-relaxed text-purple-100 md:text-base">
                {intelligence.nextAction.health.reason}
              </p>


              {/* status pills */}
              <div className="mt-6 flex flex-wrap gap-2">

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${toneFor(
                    intelligence.nextAction.health.label
                  )}`}
                >
                  {intelligence.nextAction.health.label}
                </span>

                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
                  Priority:{" "}
                  {intelligence.nextAction.priority ?? "MEDIUM"}
                </span>

                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
                  Progress:{" "}
                  {intelligence.nextAction.progress ?? 0}%
                </span>

              </div>


              {/* recommended action */}
              <div className="mt-7 max-w-3xl rounded-2xl border border-white/10 bg-black/10 p-5 backdrop-blur">

                <p className="text-[10px] font-semibold tracking-[0.25em] text-purple-100">
                  NEXT BEST ACTION
                </p>

                <p className="mt-2 text-sm leading-relaxed text-white md:text-base">
                  {intelligence.nextAction.health.action}
                </p>

              </div>


              {/* progress */}
              <div className="mt-7 max-w-3xl">

                <div className="flex justify-between text-[10px] font-medium text-purple-100/70">
                  <span>FOCUS PROGRESS</span>
                  <span>
                    {intelligence.nextAction.progress ?? 0}%
                  </span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">

                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          intelligence.nextAction.progress ?? 0
                        )
                      )}%`,
                    }}
                  />

                </div>

              </div>


              {/* actions */}
              <div className="mt-7 flex flex-wrap gap-3">

                <Link
                  href="/capture"
                  className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-purple-700 shadow-sm transition hover:bg-purple-50"
                >
                  ⚡ Start Focus
                </Link>

                <button
                  onClick={() =>
                    markComplete(
                      intelligence.nextAction!.id
                    )
                  }
                  disabled={
                    completingId ===
                    intelligence.nextAction.id
                  }
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                >
                  {completingId ===
                  intelligence.nextAction.id
                    ? "Saving..."
                    : "✓ Complete"}
                </button>

              </div>

            </div>

          ) : (

            <div className="mt-8">

              <div className="mt-8 max-w-4xl">

  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">
    <span className="h-2 w-2 rounded-full bg-emerald-300" />
    <span className="text-[10px] font-semibold tracking-[0.2em] text-purple-100">
      ALL CAUGHT UP
    </span>
  </div>

  <h3 className="mt-5 text-3xl font-bold leading-tight md:text-5xl">
    You're clear for now.
  </h3>

  <p className="mt-5 max-w-2xl text-sm leading-relaxed text-purple-100 md:text-base">
    ITACHI isn't detecting any active commitment that needs
    your attention right now.
  </p>

  <p className="mt-2 max-w-2xl text-sm text-purple-100/70">
    Capture something new whenever you're ready, and ITACHI
    will figure out what matters next.
  </p>

  <Link
    href="/capture"
    className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-purple-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-purple-50"
  >
    ✦ Capture something new
  </Link>

</div>
</div>
          )}

        </div>
      </section>


      {/* =======================================================
          QUICK STATS
      ======================================================= */}
      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">

        {[
          {
            label: "Active commitments",
            value: intelligence.active.length,
            detail: "currently open",
            icon: "✓",
            tone: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "At risk",
            value: intelligence.atRisk.length,
            detail: "need attention",
            icon: "!",
            tone: "text-rose-600",
            bg: "bg-rose-50",
          },
          {
            label: "Loose ends",
            value: intelligence.looseEnds.length,
            detail: "without progress",
            icon: "◌",
            tone: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "Evidence logged",
            value: intelligence.evidenceLogged,
            detail: "linked updates",
            icon: "↗",
            tone: "text-emerald-600",
            bg: "bg-emerald-50",
          },
        ].map((stat) => (

          <div
            key={stat.label}
            className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
          >

            <div className="flex items-start justify-between">

              <div>
                <p className="text-xs font-medium text-slate-400">
                  {stat.label}
                </p>

                <p className={`mt-3 text-3xl font-bold tracking-tight ${stat.tone}`}>
                  {stat.value}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {stat.detail}
                </p>
              </div>

              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg} ${stat.tone}`}
              >
                {stat.icon}
              </div>

            </div>

          </div>

        ))}

      </section>


      {/* =======================================================
          ACTIVITY + AI INSIGHT
      ======================================================= */}
      <section className="mt-6 grid gap-6 lg:grid-cols-3">

        {/* Recent commitments */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">

          <div className="flex items-start justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Recent work
              </p>

              <h3 className="mt-2 text-xl font-bold">
                Your commitments
              </h3>
            </div>

            <Link
              href="/commitments"
              className="text-xs font-semibold text-purple-600 hover:text-purple-700"
            >
              View all →
            </Link>

          </div>


          <div className="mt-6 space-y-3">

            {intelligence.assessed.length === 0 ? (

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-xl">
  ✦
</div>

<p className="mt-4 font-semibold text-slate-700">
  Your workspace is clear.
</p>

<p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
  No active commitments are waiting right now.
  Capture something whenever new work comes up.
</p>
                <Link
                  href="/capture"
                  className="mt-5 inline-flex rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  + Capture something
                </Link>

              </div>

            ) : (

              intelligence.assessed
                .slice(0, 4)
                .map((item) => (

                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-4 transition hover:border-purple-200 hover:bg-purple-50/30"
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="min-w-0">

                        <h4 className="truncate text-sm font-semibold">
                          {item.title}
                        </h4>

                        <p className="mt-1 text-xs text-slate-400">
                          {item.project || "General"}
                          {item.deadline
                            ? ` · Due ${item.deadline}`
                            : ""}
                        </p>

                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${toneFor(
                          item.health.label
                        )}`}
                      >
                        {item.health.label}
                      </span>

                    </div>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">

                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              item.progress ?? 0
                            )
                          )}%`,
                        }}
                      />

                    </div>

                  </article>

                ))

            )}

          </div>

        </div>


        {/* AI Insight */}
        <aside className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-white p-6 shadow-sm">

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-xl">
            ✦
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
            ITACHI insight
          </p>

          <h3 className="mt-2 text-xl font-bold">
            {intelligence.nextAction
              ? "Something deserves your attention."
              : "You're currently clear."}
          </h3>

          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {intelligence.nextAction
              ? intelligence.nextAction.health.reason
              : "There are no active commitments demanding immediate attention. Capture something new whenever you're ready."}
          </p>

          {intelligence.nextAction && (
            <div className="mt-5 rounded-2xl border border-purple-100 bg-white p-4">

              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-500">
                Suggested next step
              </p>

              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">
                {intelligence.nextAction.health.action}
              </p>

            </div>
          )}

          <Link
            href="/insights"
            className="mt-5 inline-flex text-sm font-semibold text-purple-600"
          >
            Explore insights →
          </Link>

        </aside>

      </section>


      {/* =======================================================
          CONTEXT RESURRECTION
      ======================================================= */}
      {intelligence.nextAction &&
        intelligence.contextForNextAction.length > 0 && (

          <section className="mt-6 rounded-3xl border border-purple-100 bg-white p-6 shadow-sm md:p-7">

            <div className="flex items-start gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-xl">
                🧠
              </div>

              <div>

                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Context resurrection
                </p>

                <h3 className="mt-2 text-xl font-bold">
                  ITACHI remembers related work.
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Previous captures connected to{" "}
                  <span className="font-medium text-purple-600">
                    {intelligence.nextAction.title}
                  </span>
                  .
                </p>

              </div>

            </div>


            <div className="mt-6 grid gap-3 md:grid-cols-3">

              {intelligence.contextForNextAction.map(
                ({ capture, score, text }) => (

                  <article
                    key={capture.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                  >

                    <div className="flex items-center justify-between gap-2">

                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-purple-500">
                        Related capture
                      </span>

                      <span className="text-[10px] text-slate-400">
                        {score} match
                        {score === 1 ? "" : "es"}
                      </span>

                    </div>

                    {capture.title && (
                      <h4 className="mt-3 text-sm font-semibold">
                        {capture.title}
                      </h4>
                    )}

                    <p className="mt-2 line-clamp-5 text-xs leading-relaxed text-slate-500">
                      {text}
                    </p>

                  </article>

                )
              )}

            </div>

          </section>

        )}


      {/* =======================================================
          CAPTURE CTA
      ======================================================= */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">

        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">

          <div>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
              Give ITACHI more context
            </p>

            <h3 className="mt-2 text-xl font-bold">
              Capture anything you're working on.
            </h3>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Text, voice, camera or files. ITACHI will look for
              commitments hidden inside.
            </p>

          </div>

          <Link
            href="/capture"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition hover:scale-[1.02]"
          >
            + Capture anything
          </Link>

        </div>

      </section>

    </div>


    {/* =========================================================
        MOBILE NAV
    ========================================================= */}
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-xl md:hidden">

      <div className="grid grid-cols-5">

        <Link
          href="/"
          className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-purple-600"
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


    {/* =========================================================
        LOADING
    ========================================================= */}
    {loading && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#F6F7FF]/80 backdrop-blur-md">

        <div className="rounded-3xl border border-purple-100 bg-white p-8 shadow-2xl shadow-purple-200/40">

          <SharinganLoader label="Reading your commitments" />

        </div>

      </div>
    )}

  </main>
);
}