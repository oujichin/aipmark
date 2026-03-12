import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, ROLE_LABELS } from "@/lib/auth";
import { SessionProvider } from "@/components/session-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <SessionProvider>
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header user={session.user} roleLabel={ROLE_LABELS[session.user.role] ?? session.user.role} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
