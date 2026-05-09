"use client";

import dynamic from "next/dynamic";
import type { SafeUser } from "@/lib/types";

const WorkbenchApp = dynamic(() => import("@/App"), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-screen place-items-center bg-neutral-50 text-sm text-neutral-500">
      Loading workbench...
    </div>
  ),
});

export function WorkbenchClient({ initialUser }: { initialUser: SafeUser }) {
  return <WorkbenchApp initialUser={initialUser} />;
}
