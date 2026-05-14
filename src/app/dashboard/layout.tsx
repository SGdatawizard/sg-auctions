"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/navigation/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      setLoading(false);
    }
    checkSession();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e1e38] flex items-center justify-center">
        <div className="text-[#6687bc] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e1e38] flex">
      <Sidebar user={user ?? {}} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto bg-[#0e1e38]">
        {children}
      </main>
    </div>
  );
}
