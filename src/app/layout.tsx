import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";

import { auth } from "@/lib/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "מאקרו ישראל",
  description: "מסך נתוני מאקרו של למ״ס ובנק ישראל",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html dir="rtl" lang="he">
      <body className="antialiased">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
