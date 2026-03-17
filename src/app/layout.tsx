import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "מאקרו ישראל",
  description: "מסך נתוני מאקרו של למ״ס ובנק ישראל",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html dir="rtl" lang="he">
      <body className="antialiased">{children}</body>
    </html>
  );
}
