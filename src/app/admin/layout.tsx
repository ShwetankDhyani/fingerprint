import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[70vh] bg-[radial-gradient(circle_at_top_left,_rgba(31,107,74,0.12),_transparent_45%),linear-gradient(180deg,#eef3f0_0%,#e7ece9_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.08),_transparent_40%),linear-gradient(180deg,#0c1612_0%,#121c18_100%)]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">{children}</div>
    </div>
  );
}
