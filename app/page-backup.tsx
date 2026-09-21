"use client";



import { OneThingMode } from "@/components/one-thing-mode";



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







const toneFor = (label: string) => {



  if (label === "OVERDUE")



    return "bg-red-500/15 text-red-300";







  if (label === "DUE SOON")



    return "bg-orange-500/15 text-orange-300";







  if (label === "LOOSE END")



    return "bg-yellow-500/15 text-yellow-300";







  if (label === "COMPLETED")



    return "bg-emerald-500/15 text-emerald-300";







  return "bg-sky-500/15 text-sky-300";



};







const priorityTone = (priority?: string) => {



  if (priority === "HIGH")



    return "text-red-300 bg-red-500/10 border-red-500/20";







  if (priority === "LOW")



    return "text-sky-300 bg-sky-500/10 border-sky-500/20";







  return "text-orange-300 bg-orange-500/10 border-orange-500/20";



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







const CONTEXT\_STOP\_WORDS = new Set([



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



          !CONTEXT\_STOP\_WORDS.has(word)



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



    useState\<CommitmentRecord[]>([]);







  const [captures, setCaptures] =



    useState\<CaptureRecord[]>([]);







  const [loading, setLoading] =



    useState(true);







  const [completingId, setCompletingId] =



    useState\<string | null>(null);







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







  /* =========================================================



     UI



     ========================================================= */







  return (



    \<main className="itachi-shell min-h-screen bg-[#050505] text-white">







      {/* =====================================================



          HEADER



      ===================================================== */}







      \<header className="border-b border-white/10 px-4 py-4 md:px-10 md:py-5 flex items-center justify-between">



        \<div>



          \<h1 className="itachi-brand text-xl md:text-2xl font-bold tracking-[0.22em] text-red-100">



            ITACHI



          \</h1>







          \<p className="text-[9px] md:text-[10px] tracking-[0.25em] text-red-400/70 mt-1">



            COMMITMENT INTELLIGENCE



          \</p>



        \</div>







        \<Link



          href="/capture"



          className="rounded-xl bg-white text-black px-4 md:px-5 py-2.5 md:py-3 text-sm font-semibold hover:bg-gray-200 transition"



        >



          + Capture



        \</Link>



      \</header>







      \<div className="max-w-7xl mx-auto p-4 pb-24 md:p-10">







        {/* =====================================================



            NEXT BEST ACTION



        ===================================================== */}







        \<section className="itachi-panel relative overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-[#230609] via-[#100406] to-[#050505] p-6 md:p-10">







          \<div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-red-500/15" />







          \<div className="absolute -right-8 -top-8 h-40 w-40 rounded-full border border-red-500/15" />







          \<div className="absolute right-10 top-10 h-20 w-20 rounded-full border border-red-500/10" />







          \<div className="relative z-10">







            \<div className="flex items-center gap-3 mb-4">



              \<span className="flex h-9 w-9 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-300">



                🎯



              \</span>







              \<p className="text-xs tracking-[0.3em] text-red-400">



                NEXT BEST ACTION



              \</p>



            \</div>







            {loading ? (



              \<h2 className="text-3xl md:text-5xl font-semibold leading-tight">



                Reading your commitments...



              \</h2>



            ) : intelligence.nextAction ? (



              <>



                \<h2 className="text-3xl md:text-5xl font-semibold leading-tight max-w-4xl">



                  Focus on{" "}



                  \<span className="text-red-300">



                    {intelligence.nextAction.title}



                  \</span>



                \</h2>







                \<p className="text-gray-400 mt-5 max-w-3xl text-base md:text-lg leading-relaxed">



                  {intelligence.nextAction.health.reason}



                \</p>







                \<div className="flex flex-wrap gap-2 mt-6">







                  \<span



                    className={\`px-3 py-1.5 rounded-full border text-xs font-medium ${toneFor(



                      intelligence.nextAction.health.label



                    )}\`}



                  >



                    {intelligence.nextAction.health.label}



                  \</span>







                  \<span



                    className={\`px-3 py-1.5 rounded-full border text-xs font-medium ${priorityTone(



                      intelligence.nextAction.priority



                    )}\`}



                  >



                    Priority:{" "}



                    {intelligence.nextAction.priority ??



                      "MEDIUM"}



                  \</span>







                  \<span className="px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs text-gray-300">



                    Evidence:{" "}



                    {intelligence.nextAction.evidenceCount ??



                      0}



                  \</span>







                  \<span className="px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs text-gray-300">



                    Progress:{" "}



                    {intelligence.nextAction.progress ??



                      0}



                    %



                  \</span>



                \</div>







                \<div className="mt-7 max-w-3xl rounded-2xl border border-red-500/15 bg-black/20 p-5">



                  \<p className="text-[10px] tracking-[0.25em] text-red-400">



                    ⚡ RECOMMENDED ACTION



                  \</p>







                  \<p className="mt-2 text-sm md:text-base text-gray-200">



                    {intelligence.nextAction.health.action}



                  \</p>



                \</div>







                \<div className="flex flex-wrap gap-3 mt-7">







                  \<Link



                    href="/capture"



                    className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition"



                  >



                    ⚡ Work on this



                  \</Link>







                  \<button



                    onClick={() =>



                      markComplete(



                        intelligence.nextAction!.id



                      )



                    }



                    disabled={



                      completingId ===



                      intelligence.nextAction.id



                    }



                    className="inline-flex items-center gap-2 border border-emerald-400/30 bg-emerald-400/5 text-emerald-300 px-5 py-3 rounded-xl font-medium hover:bg-emerald-400/10 disabled:opacity-50 transition"



                  >



                    {completingId ===



                    intelligence.nextAction.id



                      ? "Saving..."



                      : "✓ Mark complete"}



                  \</button>







                \</div>



              \</>



            ) : (



              <>



                \<h2 className="text-3xl md:text-5xl font-semibold leading-tight">



                  Capture your first commitment.



                \</h2>







                \<p className="text-gray-400 mt-5 max-w-2xl">



                  Tell ITACHI what you promised to do.



                  It will track the deadline and wait



                  for evidence of progress.



                \</p>







                \<Link



                  href="/capture"



                  className="inline-block mt-7 bg-white text-black px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition"



                >



                  ⚡ Capture a commitment



                \</Link>



              \</>



            )}







          \</div>



        \</section>







        {/* =====================================================



            CONTEXT RESURRECTION



        ===================================================== */}







        {intelligence.nextAction &&



          intelligence.contextForNextAction.length > 0 && (



            \<section className="mt-6 itachi-panel rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.08] via-[#090609] to-[#050505] p-6 md:p-7">







              \<div className="flex items-start gap-4">







                \<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-500/10 text-xl">



                  🧠



                \</div>







                \<div className="min-w-0">



                  \<p className="text-[10px] tracking-[0.3em] text-purple-300">



                    CONTEXT RESURRECTION



                  \</p>







                  \<h3 className="text-xl md:text-2xl font-semibold mt-2">



                    ITACHI remembers related work



                  \</h3>







                  \<p className="text-sm text-gray-400 mt-2 max-w-3xl">



                    Previous captures connected to{" "}



                    \<span className="text-purple-300">



                      {intelligence.nextAction.title}



                    \</span>



                    .



                  \</p>



                \</div>







              \</div>







              \<div className="grid md:grid-cols-3 gap-3 mt-6">







                {intelligence.contextForNextAction.map(



                  ({ capture, score, text }) => (



                    \<article



                      key={capture.id}



                      className="rounded-xl border border-white/10 bg-black/20 p-4 hover:border-purple-400/20 transition"



                    >







                      \<div className="flex items-center justify-between gap-3">



                        \<span className="text-[10px] tracking-wider text-purple-300">



                          RELATED CAPTURE



                        \</span>







                        \<span className="text-[10px] text-gray-600">



                          {score} match



                          {score === 1 ? "" : "es"}



                        \</span>



                      \</div>







                      {capture.title && (



                        \<h4 className="font-medium text-sm mt-3">



                          {capture.title}



                        \</h4>



                      )}







                      \<p className="text-xs leading-relaxed text-gray-400 mt-3 line-clamp-5">



                        {text}



                      \</p>







                    \</article>



                  )



                )}







              \</div>







              \<div className="mt-5 rounded-xl border border-purple-400/10 bg-purple-400/[0.04] p-4">







                \<p className="text-[10px] tracking-[0.25em] text-purple-300">



                  🧠 ITACHI INSIGHT



                \</p>







                \<p className="text-sm text-gray-300 mt-2 leading-relaxed">



                  These previous captures provide context



                  for your current commitment. ITACHI connects



                  your past work with what you need to do next.



                \</p>







              \</div>







            \</section>



          )}







                  {/* =====================================================

              ONE THING MODE

          ===================================================== */}



          {intelligence.nextAction && (

            \<div className="my-6 md:my-8">

              \<OneThingMode

                title={intelligence.nextAction.title}

                reason={intelligence.nextAction.health.reason}

                action={intelligence.nextAction.health.action}

                priority={intelligence.nextAction.priority}

                status={intelligence.nextAction.health.label}

                progress={intelligence.nextAction.progress ?? 0}

                completing={

                  completingId === intelligence.nextAction.id

                }

                onComplete={() =>

                  markComplete(intelligence.nextAction!.id)

                }

              />

            \</div>

          )}



{/* =====================================================



            STATS



        ===================================================== */}







        \<section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 my-6 md:my-8">







          {[



            [



              "Active commitments",



              String(intelligence.active.length),



              "currently open",



            ],



            [



              "At risk",



              String(intelligence.atRisk.length),



              "overdue or due within 48h",



            ],



            [



              "Loose ends",



              String(intelligence.looseEnds.length),



              "no evidence linked yet",



            ],



            [



              "Evidence logged",



              String(intelligence.evidenceLogged),



              "progress updates linked",



            ],



          ].map(



            ([label, value, detail]) => (



              \<div



                key={label}



                className="itachi-panel rounded-2xl border border-red-500/15 bg-[#090609] p-4 md:p-5"



              >



                \<p className="text-xs text-gray-500">



                  {label}



                \</p>







                \<p className="text-3xl font-semibold mt-5">



                  {value}



                \</p>







                \<p className="text-xs text-gray-600 mt-2">



                  {detail}



                \</p>



              \</div>



            )



          )}







        \</section>







        {/* =====================================================



            COMMITMENTS + INTELLIGENCE



        ===================================================== */}







        \<section className="grid lg:grid-cols-3 gap-6">







          {/* ===================================================



              ACTIVE COMMITMENTS



          =================================================== */}







          \<div className="itachi-panel lg:col-span-2 rounded-2xl border border-red-500/15 bg-[#090609] p-6">







            \<p className="text-[10px] tracking-[0.3em] text-gray-500">



              ACTIVE COMMITMENTS



            \</p>







            \<h3 className="text-xl font-semibold mt-2">



              What you said you would do



            \</h3>







            \<div className="space-y-3 mt-6">







              {!loading &&



                intelligence.assessed.length === 0 && (



                  \<p className="text-gray-500 py-8 text-center">



                    No commitments yet. Start with a capture.



                  \</p>



                )}







              {intelligence.assessed.map(



                (item) => (



                  \<article



                    key={item.id}



                    className="border border-white/5 rounded-xl p-5"



                  >







                    \<div className="flex items-start justify-between gap-4">







                      \<div>







                        \<h4 className="font-medium">



                          {item.title}



                        \</h4>







                        \<p className="text-xs text-gray-500 mt-1">



                          {item.project || "General"}



                          {item.deadline



                            ? \` · Due ${item.deadline}\`



                            : " · No deadline"}



                        \</p>







                      \</div>







                      \<span



                        className={\`text-[10px] px-3 py-1 rounded-full ${toneFor(



                          item.health.label



                        )}\`}



                      >



                        {item.health.label}



                      \</span>







                    \</div>







                    \<div className="flex justify-between items-center text-xs text-gray-500 mt-5">







                      \<span>



                        Evidence linked:{" "}



                        {item.evidenceCount ?? 0}



                      \</span>







                      \<button



                        onClick={() =>



                          markComplete(item.id)



                        }



                        disabled={



                          completingId === item.id



                        }



                        className="rounded-lg border border-emerald-400/30 px-3 py-1.5 text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-50"



                      >



                        {completingId === item.id



                          ? "Saving…"



                          : "✓ Mark complete"}



                      \</button>







                    \</div>







                    \<div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">







                      \<div



                        className="h-full bg-white rounded-full transition-all duration-500"



                        style={{



                          width: \`${Math.min(



                            100,



                            Math.max(



                              0,



                              item.progress ?? 0



                            )



                          )}%\`,



                        }}



                      />







                    \</div>







                    {item.latestEvidence && (



                      \<div className="mt-4 rounded-lg border border-sky-400/10 bg-sky-400/[0.04] px-3 py-2.5">







                        \<p className="text-[10px] tracking-wider text-sky-300">



                          LATEST LINKED EVIDENCE



                        \</p>







                        \<p className="mt-1 text-xs leading-relaxed text-gray-300">



                          “{item.latestEvidence}”



                        \</p>







                      \</div>



                    )}







                  \</article>



                )



              )}







            \</div>



          \</div>







          {/* ===================================================



              INTELLIGENCE



          =================================================== */}







          \<aside className="itachi-panel rounded-2xl border border-red-500/15 bg-[#090609] p-6">







            \<p className="text-[10px] tracking-[0.3em] text-red-400">



              INTELLIGENCE



            \</p>







            {/* LOOSE END RADAR */}







            \<h3 className="text-xl font-semibold mt-3">



              Loose End Radar



            \</h3>







            \<div className="mt-6 space-y-3">







              {intelligence.looseEnds



                .slice(0, 3)



                .map((item) => (



                  \<div



                    key={item.id}



                    className="rounded-xl bg-white/[0.04] p-4"



                  >



                    \<p className="font-medium text-sm">



                      {item.title}



                    \</p>







                    \<p className="text-xs text-yellow-300 mt-2">



                      No evidence yet



                    \</p>



                  \</div>



                ))}







              {intelligence.looseEnds.length ===



                0 && (



                  \<p className="text-sm text-gray-500">



                    No loose ends right now.



                  \</p>



                )}







            \</div>







            {/* COMMITMENT DRIFT */}







            {intelligence.atRisk.length >



              0 && (



              <>



                \<h3 className="text-xl font-semibold mt-8">



                  Commitment Drift



                \</h3>







                \<div className="mt-4 rounded-xl border border-red-500/15 bg-red-500/[0.04] p-4">







                  \<p className="font-medium text-sm">



                    {intelligence.atRisk[0].title}



                  \</p>







                  \<p className="text-sm text-red-300 mt-2">



                    {



                      intelligence.atRisk[0]



                        .health.description



                    }



                  \</p>







                \</div>



              \</>



            )}







            {/* NEXT ACTION */}







            {intelligence.nextAction && (



              \<div className="mt-8 rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.08] to-transparent p-4">







                \<p className="text-[10px] tracking-[0.25em] text-red-400">



                  🎯 ITACHI SAYS



                \</p>







                \<p className="font-semibold text-sm mt-3">



                  {



                    intelligence.nextAction.health



                      .action



                  }



                \</p>







                \<p className="text-xs text-gray-500 mt-2">



                  {



                    intelligence.nextAction.health



                      .reason



                  }



                \</p>







              \</div>



            )}







          \</aside>







        \</section>







      \</div>







      {/* =====================================================



          MOBILE NAV



      ===================================================== */}







      \<nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-white/10 bg-[#090909]/95 backdrop-blur px-4 py-3 flex items-center justify-around z-20">







        \<Link



          href="/"



          className="text-xs text-white"



        >



          ◉ Overview



        \</Link>







        \<Link



          href="/capture"



          className="rounded-full bg-purple-600 px-5 py-2 text-xs font-semibold"



        >



          ＋ Capture



        \</Link>







        \<span className="text-xs text-gray-500">



          ✦ Intelligence



        \</span>







      \</nav>







      {/* =====================================================



          LOADING



      ===================================================== */}







      {loading && (



        \<div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm">







          \<div className="itachi-panel rounded-3xl border border-red-500/25 bg-[#0b0507] px-10 py-9">







            \<SharinganLoader label="Scanning commitments" />







          \</div>







        \</div>



      )}







    \</main>



  );



}