"use client";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { useEffect, useState } from "react";

import Link from "next/link";
import { auth } from "@/lib/firebase";

export default function ProfilePage() {
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

      setEmail(user.email ?? "");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

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

      <div className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12">
        {/* INTRO */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-600">
            Profile
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">
            Your ITACHI workspace.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 md:text-base">
            Manage your account and access the tools that help ITACHI
            understand your commitments.
          </p>
        </section>

        {/* ACCOUNT */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-600 to-violet-400 text-3xl font-bold text-white shadow-lg shadow-purple-200">
              {email
                ? email.charAt(0).toUpperCase()
                : "I"}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Signed in account
              </p>

              <h2 className="mt-2 text-xl font-bold">
                {loading ? "Loading..." : email || "ITACHI User"}
              </h2>

              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Account active
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCT */}
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-xl">
              🧠
            </div>

            <h2 className="mt-5 text-lg font-bold">
              Commitment Intelligence
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              ITACHI discovers commitments from the things you
              capture and connects them to evidence, deadlines and
              progress.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-xl">
              ⚡
            </div>

            <h2 className="mt-5 text-lg font-bold">
              Capture anywhere
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Use text, voice, camera and other capture methods to
              give ITACHI the context it needs.
            </p>
          </div>
        </section>

        {/* QUICK LINKS */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Workspace
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Link
              href="/"
              className="rounded-2xl border border-slate-200 p-4 transition hover:border-purple-200 hover:bg-purple-50/50"
            >
              <p className="font-semibold">⌂ Home</p>
              <p className="mt-1 text-xs text-slate-500">
                See what matters now.
              </p>
            </Link>

            <Link
              href="/commitments"
              className="rounded-2xl border border-slate-200 p-4 transition hover:border-purple-200 hover:bg-purple-50/50"
            >
              <p className="font-semibold">✓ Commitments</p>
              <p className="mt-1 text-xs text-slate-500">
                Review your workload.
              </p>
            </Link>

            <Link
              href="/insights"
              className="rounded-2xl border border-slate-200 p-4 transition hover:border-purple-200 hover:bg-purple-50/50"
            >
              <p className="font-semibold">◉ Insights</p>
              <p className="mt-1 text-xs text-slate-500">
                Explore ITACHI intelligence.
              </p>
            </Link>
          </div>
        </section>

        {/* SIGN OUT */}
        <section className="mt-6 rounded-3xl border border-rose-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
            Account
          </p>

          <h2 className="mt-2 text-lg font-bold">
            Sign out of ITACHI
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Your Firebase data remains associated with your account.
          </p>

          <button
            onClick={handleSignOut}
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
          >
            Sign out
          </button>
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
            className="flex flex-col items-center gap-1 py-3 text-xs text-slate-500"
          >
            <span className="text-lg">◉</span>
            <span>Insights</span>
          </Link>

          <Link
            href="/profile"
            className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-purple-600"
          >
            <span className="text-lg">○</span>
            <span>Profile</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}