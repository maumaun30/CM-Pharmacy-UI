import type { Metadata } from "next";
import ConsoleGuard from "./_components/ConsoleGuard";
import ConsoleShell from "./_components/ConsoleShell";

export const metadata: Metadata = {
  title: "Time console",
};

export default function TimeConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConsoleGuard>
      <ConsoleShell>{children}</ConsoleShell>
    </ConsoleGuard>
  );
}
