import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/AdminApp";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Every address under /admin. The screen itself reads the address to decide what to show.
export default function Page() {
  return <AdminApp />;
}
