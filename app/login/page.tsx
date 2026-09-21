"use client";

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (signup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <h1 className="text-4xl font-bold mb-2">ITACHI</h1>
        <p className="text-zinc-400 mb-8">Intelligence System</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 rounded-lg bg-zinc-900 border border-zinc-800"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 rounded-lg bg-zinc-900 border border-zinc-800"
            required
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full p-4 rounded-lg bg-white text-black font-semibold"
          >
            {signup ? "Create Account" : "Enter ITACHI"}
          </button>
        </form>

        <button
          onClick={() => setSignup(!signup)}
          className="mt-6 text-zinc-400 hover:text-white"
        >
          {signup
            ? "Already have an account? Sign in"
            : "New here? Create account"}
        </button>
      </div>
    </main>
  );
}
