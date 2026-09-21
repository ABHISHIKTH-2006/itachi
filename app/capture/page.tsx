"use client";



import {

  ArrowLeft,

  Camera,

  Mic,

  Sparkles,

  Upload,

} from "lucide-react";

import {

  addDoc,

  arrayUnion,

  collection,

  doc,

  getDocs,

  increment,

  query,

  serverTimestamp,

  updateDoc,

  where,

} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

import { findEvidenceMatches, type CommitmentRecord } from "@/lib/commitment-intelligence";



import type { ChangeEvent } from "react";

import Link from "next/link";

import { useEffect, useState } from "react";



type Commitment = {

  title: string;

  description: string;

  deadline: string | null;

  project: string;

  priority: "LOW" | "MEDIUM" | "HIGH";

  risk: "LOW" | "MEDIUM" | "HIGH";

  confidence: number;

};



type AnalysisResult = {

  summary?: string;

  commitments?: Commitment[];

};



export default function CapturePage() {

  const [text, setText] = useState("");

  const [loading, setLoading] = useState(false);

  const [result, setResult] =

    useState<AnalysisResult | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraImage, setCameraImage] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);




  // ==========================================

  // SAVE CAPTURE + COMMITMENTS TO FIRESTORE

  // ==========================================



  const saveToFirestore = async (

    originalText: string,

    commitments: Commitment[]

  ) => {

    const user = auth.currentUser;



    if (!user) {

      throw new Error("Please login first.");

    }



    // -----------------------------

    // 1. Save original capture

    // -----------------------------



    await addDoc(collection(db, "captures"), {

      userId: user.uid,

      content: originalText,

      type: "COMMITMENT",

      linkedCommitmentIds: [],

      createdAt: serverTimestamp(),

    });



    // -----------------------------

    // 2. Save commitments

    // -----------------------------



    for (const commitment of commitments) {

      await addDoc(collection(db, "commitments"), {

        userId: user.uid,



        title: commitment.title,



        description:

          commitment.description || "",



        deadline:

          commitment.deadline || null,



        project:

          commitment.project || "General",



        priority:

          commitment.priority || "MEDIUM",



        risk:

          commitment.risk || "LOW",



        confidence:

          typeof commitment.confidence === "number"

            ? commitment.confidence

            : 0,



        status: "OPEN",



        progress: 0,



        evidenceCount: 0,

        evidenceIds: [],

        lastEvidenceAt: null,



        createdAt: serverTimestamp(),

      });

    }



    console.log(

      "🔥 ITACHI: Capture and commitments saved!"

    );

  };



  const saveAndLinkEvidence = async (originalText: string) => {

    const user = auth.currentUser;

    if (!user) throw new Error("Please login first.");



    const captureRef = await addDoc(collection(db, "captures"), {

      userId: user.uid,

      content: originalText,

      type: "EVIDENCE",

      linkedCommitmentIds: [],

      createdAt: serverTimestamp(),

    });



    const commitmentsSnapshot = await getDocs(query(collection(db, "commitments"), where("userId", "==", user.uid)));

    const commitments: CommitmentRecord[] = commitmentsSnapshot.docs.map((item) => ({

      id: item.id,

      ...(item.data() as Omit<CommitmentRecord, "id">),

    }));

    const matches = findEvidenceMatches(originalText, commitments);

    if (matches.length === 0) return 0;



    await Promise.all([

      updateDoc(captureRef, { linkedCommitmentIds: matches.map((match) => match.id) }),

      ...matches.map((match) => updateDoc(doc(db, "commitments", match.id), {

        evidenceIds: arrayUnion(captureRef.id),

        evidenceCount: increment(1),

        lastEvidenceAt: serverTimestamp(),

        updatedAt: serverTimestamp(),

      })),

    ]);

    return matches.length;

  };



  // ==========================================

  // ANALYZE TEXT WITH GEMINI

  // ==========================================



  const analyzeText = async () => {

    if (!text.trim()) {

      return;

    }



    const user = auth.currentUser;



    if (!user) {

      alert("Please login first.");

      return;

    }



    setLoading(true);

    setResult(null);



    try {

      // --------------------------------

      // STEP 1: Send text to Gemini

      // --------------------------------



      const response = await fetch("/api/analyze", {

        method: "POST",



        headers: {

          "Content-Type": "application/json",

        },



        body: JSON.stringify({

          text: text.trim(),

        }),

      });



      const data = await response.json();



      // --------------------------------

      // STEP 2: Check Gemini response

      // --------------------------------



      if (!response.ok) {

        throw new Error(

          data.error || "AI analysis failed."

        );

      }



      // --------------------------------

      // STEP 3: Show AI result

      // --------------------------------



      setResult(data);



      // --------------------------------

      // STEP 4: Save to Firestore

      // --------------------------------



      if (data.commitments?.length) {

        try {

          await saveToFirestore(

            text.trim(),

            data.commitments

          );



          alert(

            "✅ AI analysis complete and saved to Firestore!"

          );

        } catch (firestoreError) {

          console.error(

            "FIRESTORE ERROR:",

            firestoreError

          );



          alert(

            "⚠️ AI analysis worked, but Firestore save failed. Check Firebase configuration/database."

          );

        }

      } else {

        // Save capture even if no commitments found

        try {

          const linkedCount = await saveAndLinkEvidence(text.trim());



          alert(

            linkedCount > 0

              ? `✅ Progress update saved and linked to ${linkedCount} commitment${linkedCount === 1 ? "" : "s"}.`

              : "✅ Update saved. ITACHI found no matching commitment to link."

          );

        } catch (firestoreError) {

          console.error(

            "FIRESTORE ERROR:",

            firestoreError

          );



          alert(

            "⚠️ AI analysis worked, but Firestore save failed."

          );

        }

      }

    } catch (error) {

      console.error(

        "ITACHI AI ERROR:",

        error

      );



      alert(

        error instanceof Error

          ? error.message

          : "Something went wrong."

      );

    } finally {

      setLoading(false);

    }

  };



    // ==========================================
  // CAMERA AI
  // ==========================================

  const openCamera = () => {
  setCameraImage(null);
  setCameraOpen(true);
};
useEffect(() => {
  if (!cameraOpen || cameraImage) return;

  let stream: MediaStream | null = null;

  const startCamera = async () => {
    try {
      const video = document.getElementById(
        "itachi-camera-preview"
      ) as HTMLVideoElement | null;

      if (!video) return;

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      video.srcObject = stream;
      await video.play();
    } catch (error) {
      console.error("ITACHI camera error:", error);
      setCameraOpen(false);

      alert(
        "Camera access failed. Please allow camera permission and try again."
      );
    }
  };

  startCamera();

  return () => {
    stream?.getTracks().forEach((track) => track.stop());
  };
}, [cameraOpen, cameraImage]);
  const closeCamera = () => {
    const video = document.getElementById(
      "itachi-camera-preview"
    ) as HTMLVideoElement | null;

    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());

    if (video) {
      video.srcObject = null;
    }

    setCameraOpen(false);
    setCameraImage(null);
  };

  const captureCameraImage = () => {
    const video = document.getElementById(
      "itachi-camera-preview"
    ) as HTMLVideoElement | null;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      alert("Camera is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      alert("Could not capture the camera image.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    setCameraImage(imageData);

    const stream = video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  const analyzeCameraImage = async () => {
    if (!cameraImage) return;

    const user = auth.currentUser;

    if (!user) {
      alert("Please login first.");
      return;
    }

    setCameraLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: cameraImage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Camera AI analysis failed.");
      }

      setResult(data);

      if (data.commitments?.length) {
        await saveToFirestore(
          "Camera capture: " + (data.summary || "Commitments detected"),
          data.commitments
        );

        alert("📷 AI found commitments and saved them to Firestore!");
      } else {
        alert("📷 Camera analyzed successfully. No commitment was found.");
      }

      closeCamera();
    } catch (error) {
      console.error("ITACHI CAMERA AI ERROR:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Camera AI analysis failed."
      );
    } finally {
      setCameraLoading(false);
    }
  };

// ==========================================

  // FILE UPLOAD

  // ==========================================



  const handleFile = (

    e: ChangeEvent<HTMLInputElement>

  ) => {

    const file = e.target.files?.[0];



    if (!file) {

      return;

    }



    setText(

      `Uploaded file: ${file.name}`

    );

  };



  // ==========================================

  // UI

  // ==========================================



  return (
  <main className="min-h-screen bg-[#F6F7FF] text-[#17203A] pb-20">

    {/* HEADER */}
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
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Home
          </Link>

          <Link
            href="/capture"
            className="rounded-xl bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700"
          >
            Capture
          </Link>

          <Link
            href="/commitments"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Commitments
          </Link>

          <Link
            href="/insights"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Insights
          </Link>

          <Link
            href="/profile"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
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


    {/* MAIN */}
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-14">

      {/* HERO */}
      <section className="text-center">

        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-purple-200 bg-white px-4 py-2 shadow-sm">
          <Sparkles size={14} className="text-purple-600" />
          <span className="text-[10px] font-semibold tracking-[0.25em] text-purple-600">
            UNIVERSAL CAPTURE
          </span>
        </div>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#17203A] md:text-6xl">
          Capture anything.
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-500 md:text-base">
          Give ITACHI the context. It will find the commitments,
          responsibilities and work hidden inside.
        </p>

      </section>


      {/* TEXT CAPTURE */}
      <section className="mx-auto mt-10 max-w-4xl">

        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-purple-100/40">

          <div className="border-b border-slate-100 bg-gradient-to-r from-purple-50 to-violet-50 px-6 py-5 md:px-8">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-200">
                <Sparkles size={19} />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-600">
                  Tell ITACHI
                </p>

                <h2 className="mt-1 text-lg font-bold text-[#17203A]">
                  What are you working on?
                </h2>
              </div>

            </div>

          </div>


          <div className="p-5 md:p-8">

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Example: I'll finish my DBMS assignment by Monday and send the design to my teammate."
              className="min-h-[220px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-5 text-base leading-relaxed text-[#17203A] outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100 md:p-6 md:text-lg"
            />


            {/* ACTIONS */}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex flex-wrap gap-2">

                <button
                  onClick={() => {
  const SpeechRecognition =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Voice capture is not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    console.log("🎙️ ITACHI voice capture started");
  };

  recognition.onresult = (event: any) => {
    const transcript =
      event.results[0][0].transcript;

    setText(transcript);
    console.log("🎙️ Transcript:", transcript);
  };

  recognition.onerror = (event: any) => {
    console.error("🎙️ Voice error:", event.error);
    alert(`Voice capture error: ${event.error}`);
  };

  recognition.onend = () => {
    console.log("🎙️ ITACHI voice capture ended");
  };

  recognition.start();
}}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                >
                  <Mic size={17} />
                  Voice
                </button>


                <button
                  onClick={openCamera}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                >
                  <Camera size={17} />
                  Camera AI
                </button>


                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700">

                  <Upload size={17} />

                  File

                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFile}
                  />

                </label>

              </div>


              <button
                onClick={analyzeText}
                disabled={loading || !text.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles size={17} />

                {loading
                  ? "ITACHI is thinking..."
                  : "Analyze with ITACHI"}
              </button>

            </div>

          </div>

        </div>

      </section>


      {/* CAPTURE METHODS */}
      <section className="mx-auto mt-8 max-w-4xl">

        <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
          Capture your work your way
        </p>

        <div className="grid gap-3 md:grid-cols-3">

          <button
            onClick={() => {
  const SpeechRecognition =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Voice capture is not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    console.log("🎙️ ITACHI voice capture started");
  };

  recognition.onresult = (event: any) => {
    const transcript =
      event.results[0][0].transcript;

    setText(transcript);
    console.log("🎙️ Transcript:", transcript);
  };

  recognition.onerror = (event: any) => {
    console.error("🎙️ Voice error:", event.error);
    alert(`Voice capture error: ${event.error}`);
  };

  recognition.onend = () => {
    console.log("🎙️ ITACHI voice capture ended");
  };

  recognition.start();
}}
            className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Mic size={18} />
            </div>

            <h3 className="mt-4 font-semibold">
              Voice
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Speak naturally about what you need to do.
            </p>
          </button>


          <button
            onClick={openCamera}
            className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Camera size={18} />
            </div>

            <h3 className="mt-4 font-semibold">
              Camera AI
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Show ITACHI a whiteboard, note or screen.
            </p>
          </button>


          <label className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Upload size={18} />
            </div>

            <h3 className="mt-4 font-semibold">
              File
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Upload a file and give ITACHI more context.
            </p>

            <input
              type="file"
              className="hidden"
              onChange={handleFile}
            />

          </label>

        </div>

      </section>


      {/* PIPELINE */}
      <section className="mx-auto mt-10 max-w-5xl">

        <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm md:p-7">

          <div className="mb-6 text-center">

            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-purple-600">
              How ITACHI works
            </p>

            <h2 className="mt-2 text-xl font-bold">
              From capture to action.
            </h2>

          </div>


          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

            {[
              {
                number: "01",
                title: "CAPTURE",
                description: "Collect your context.",
              },
              {
                number: "02",
                title: "UNDERSTAND",
                description: "Find hidden commitments.",
              },
              {
                number: "03",
                title: "CONNECT",
                description: "Link work and evidence.",
              },
              {
                number: "04",
                title: "ACT",
                description: "Know what to do next.",
              },
            ].map((step) => (

              <div
                key={step.number}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center"
              >

                <p className="text-[10px] font-bold tracking-[0.2em] text-purple-500">
                  {step.number}
                </p>

                <p className="mt-2 text-xs font-bold tracking-[0.15em] text-[#17203A]">
                  {step.title}
                </p>

                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  {step.description}
                </p>

              </div>

            ))}

          </div>

        </div>

      </section>


      {/* CAMERA MODAL */}
      {cameraOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17203A]/60 p-4 backdrop-blur-md">

          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-purple-100 bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-7">

              <div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-purple-600">
                  Camera AI
                </p>

                <h2 className="mt-1 text-lg font-bold text-[#17203A]">
                  Capture commitments from your surroundings
                </h2>

              </div>


              <button
                onClick={closeCamera}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Close
              </button>

            </div>


            <div className="p-5 md:p-7">

              <div className="aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">

                {cameraImage ? (

                  <img
                    src={cameraImage}
                    alt="Captured for ITACHI Camera AI"
                    className="h-full w-full object-contain"
                  />

                ) : (

                  <video
                    id="itachi-camera-preview"
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />

                )}

              </div>


              <div className="mt-4 rounded-2xl bg-purple-50 p-4">

                <p className="text-xs leading-relaxed text-purple-700">
                  Point the camera at a whiteboard, handwritten note,
                  meeting note, or screen containing work commitments.
                </p>

              </div>


              <div className="mt-5 flex flex-col gap-3 sm:flex-row">

                {!cameraImage ? (

                  <button
                    onClick={captureCameraImage}
                    className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 font-semibold text-white shadow-lg shadow-purple-200 transition hover:scale-[1.01]"
                  >
                    📷 Capture Image
                  </button>

                ) : (

                  <>

                    <button
                      onClick={() => {
                        setCameraImage(null);
                        openCamera();
                      }}
                      disabled={cameraLoading}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Retake
                    </button>


                    <button
                      onClick={analyzeCameraImage}
                      disabled={cameraLoading}
                      className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-3 font-semibold text-white shadow-lg shadow-purple-200 transition hover:scale-[1.01] disabled:opacity-50"
                    >
                      {cameraLoading
                        ? "ITACHI is reading..."
                        : "✨ Analyze with AI"}
                    </button>

                  </>

                )}

              </div>

            </div>

          </div>

        </div>

      )}


      {/* AI RESULT */}
      {result && (

        <section className="mx-auto mt-12 max-w-5xl">

          <div className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-xl shadow-purple-100/40 md:p-8">

            <div className="flex flex-col gap-3 border-b border-slate-100 pb-6">

              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-purple-600">
                AI INTELLIGENCE
              </p>

              <h2 className="text-2xl font-bold text-[#17203A] md:text-3xl">
                {result.summary || "Commitments detected"}
              </h2>

              <p className="text-sm text-slate-500">
                ITACHI analyzed your capture and extracted the work
                that deserves attention.
              </p>

            </div>


            {result.commitments?.length ? (

              <div className="mt-6 grid gap-4">

                {result.commitments.map((item, index) => (

                  <article
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition hover:border-purple-200 hover:bg-purple-50/30 md:p-6"
                  >

                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                      <div className="min-w-0">

                        <h3 className="text-lg font-bold text-[#17203A]">
                          {item.title}
                        </h3>

                        <p className="mt-2 text-sm leading-relaxed text-slate-500">
                          {item.description}
                        </p>

                      </div>


                      <span
                        className={`w-fit shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold ${
                          item.priority === "HIGH"
                            ? "bg-rose-50 text-rose-600"
                            : item.priority === "MEDIUM"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {item.priority}
                      </span>

                    </div>


                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                          Deadline
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#17203A]">
                          {item.deadline || "No deadline"}
                        </p>
                      </div>


                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                          Project
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#17203A]">
                          {item.project || "General"}
                        </p>
                      </div>


                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                          Risk
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#17203A]">
                          {item.risk}
                        </p>
                      </div>


                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                          Confidence
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#17203A]">
                          {Math.round(item.confidence * 100)}%
                        </p>
                      </div>

                    </div>

                  </article>

                ))}

              </div>

            ) : (

              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                  ✦
                </div>

                <h3 className="mt-4 font-bold text-[#17203A]">
                  No commitment found.
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                  ITACHI analyzed your capture but didn't find a clear
                  commitment. That's okay — your update has still been
                  processed.
                </p>

              </div>

            )}

          </div>

        </section>

      )}

    </div>


    {/* MOBILE NAV */}
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-xl md:hidden">

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
          className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-purple-600"
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


    {/* LOADING OVERLAY */}
    {(loading || cameraLoading) && (

      <div className="fixed inset-0 z-[60] grid place-items-center bg-[#F6F7FF]/80 p-5 backdrop-blur-md">

        <div className="w-full max-w-sm rounded-3xl border border-purple-100 bg-white p-8 text-center shadow-2xl shadow-purple-200/50">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
            <Sparkles size={24} />
          </div>

          <h3 className="mt-5 text-lg font-bold text-[#17203A]">
            {cameraLoading
              ? "ITACHI is reading your image..."
              : "ITACHI is understanding your capture..."}
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Connecting your context to commitments and next actions.
          </p>

          <div className="mx-auto mt-6 h-1.5 max-w-[180px] overflow-hidden rounded-full bg-purple-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-purple-600" />
          </div>

        </div>

      </div>

    )}

  </main>
);

}
