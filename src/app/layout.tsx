import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SG Auctions",
    template: "%s | SG Auctions",
  },
  description: "Auction results dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#0e1e38] text-[#f7f4ec] antialiased">
        {children}
      </body>
    </html>
  );
}
