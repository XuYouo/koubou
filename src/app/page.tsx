import { ensureBootstrap } from "@/lib/server/bootstrap";
import { getCurrentUser } from "@/lib/server/session";
import { LoginPanel } from "@/components/workbench/LoginPanel";
import { WorkbenchClient } from "@/components/workbench/WorkbenchClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureBootstrap();
  const user = await getCurrentUser();

  if (!user) {
    return <LoginPanel />;
  }

  return <WorkbenchClient initialUser={user} />;
}
