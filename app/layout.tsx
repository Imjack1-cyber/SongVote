import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import GlobalBanner from "@/components/common/GlobalBanner";
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
        {/* Mount Banner at top of everything */}
        <GlobalBanner initialData={initialAnnouncement} />
        
        {children}
        <Toaster position="top-center" richColors theme="system" /> 
      </body>
    </html>
  );
}