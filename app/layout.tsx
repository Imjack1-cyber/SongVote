import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner"; // NEW
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SongVote",
  description: "Real-time song voting platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        {children}
        {/* Toast Notifications Container */}
        <Toaster position="top-center" richColors theme="system" /> 
      </body>
    </html>
  );
}