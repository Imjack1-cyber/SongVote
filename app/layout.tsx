import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import GlobalBanner from "@/components/common/GlobalBanner";
import ProgressBarProvider from "@/components/providers/ProgressBarProvider";
import { getGlobalAnnouncement } from "@/app/actions"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SongVote",
  description: "Real-time song voting platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch initial banner state
  const initialAnnouncement = await getGlobalAnnouncement();

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        {/* Navigation Progress Bar */}
        <ProgressBarProvider />
        
        {/* Global Alert Banner */}
        <GlobalBanner initialData={initialAnnouncement} />
        
        {/* Main Content (Wrapped in template.tsx automatically by Next.js) */}
        {children}
        
        {/* Toast Notifications */}
        <Toaster position="top-center" richColors theme="system" /> 
      </body>
    </html>
  );
}