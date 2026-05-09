"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import backImage from "../../../back.png";

export function LoginPanel() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error || "Login failed");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <main
      className="grid min-h-screen place-items-center bg-neutral-950 bg-cover bg-center px-6 text-neutral-950"
      style={{
        backgroundImage: `linear-gradient(rgba(8, 8, 8, 0.34), rgba(8, 8, 8, 0.2)), url(${backImage.src})`,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm border border-white/55 bg-white/94 p-6 shadow-sm backdrop-blur-md"
      >
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Koubou"
            width={40}
            height={40}
            className="h-10 w-10 rounded object-cover"
            priority
          />
          <div>
            <h1 className="text-xl font-semibold tracking-normal">Koubou</h1>
            <p className="text-sm text-neutral-500">GPT-Image-2 workbench</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </div>
      </form>
    </main>
  );
}
