import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ThemeWrapper from '@/components/ThemeWrapper';

interface HostLayoutProps {
  children: React.ReactNode;
  params: { hostname: string };
}

export default async function HostLayout({ children, params }: HostLayoutProps) {
  const host = await prisma.host.findUnique({
    where: { username: params.hostname },
    include: { settings: true },
  });

  if (!host) {
    return notFound();
  }

  const currentUser = await getCurrentUser();
  const isOwner = currentUser?.userId === host.id;

  // Map DB settings to Config
  const themeConfig = {
    // Light
    bgColor: host.settings?.bgColor || '#f8fafc',
    fgColor: host.settings?.fgColor || '#0f172a',
    accentColor: host.settings?.accentColor || '#6366f1',
    
    // Dark (Now available in DB types)
    darkBgColor: host.settings?.darkBgColor || '#020617',
    darkFgColor: host.settings?.darkFgColor || '#f8fafc',
    darkAccentColor: host.settings?.darkAccentColor || '#818cf8',
    
    // State
    darkMode: host.settings?.darkMode || false,
  };

  return (
    <ThemeWrapper config={themeConfig}>
      <div className="flex flex-col min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
        
        <Header 
          hostName={host.username} 
          isLoggedIn={isOwner} 
          currentUser={currentUser?.username} 
        />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:px-8">
          {children}
        </main>

        <Footer hostName={host.username} />
        
      </div>
    </ThemeWrapper>
  );
}