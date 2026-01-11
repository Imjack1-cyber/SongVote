import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import ThemeWrapper from '@/components/ThemeWrapper';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Strict Auth Guard
  // Note: SUPER_ADMIN_ID must be set in your .env file
  if (!user || user.userId !== process.env.SUPER_ADMIN_ID) {
    redirect('/');
  }

  // Fetch Admin's specific host settings for theming
  const host = await prisma.host.findUnique({
    where: { id: user.userId },
    include: { settings: true },
  });

  const themeConfig = {
    bgColor: host?.settings?.bgColor || '#f8fafc',
    fgColor: host?.settings?.fgColor || '#0f172a',
    accentColor: host?.settings?.accentColor || '#6366f1',
    darkBgColor: host?.settings?.darkBgColor || '#020617',
    darkFgColor: host?.settings?.darkFgColor || '#f8fafc',
    darkAccentColor: host?.settings?.darkAccentColor || '#818cf8',
    darkMode: host?.settings?.darkMode || false,
  };

  return (
    <ThemeWrapper config={themeConfig}>
      <div className="flex flex-col min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
        <Header 
          hostName={user.username} 
          isLoggedIn={true} 
          currentUser={user.username} 
        />
        
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:px-8">
            <div className="mb-6 border-b border-[var(--border)] pb-4">
                <span className="text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-1 rounded">Super Admin</span>
                <h1 className="text-3xl font-bold mt-2">Platform Overview</h1>
            </div>
            {children}
        </main>

        <Footer hostName={user.username} />
      </div>
    </ThemeWrapper>
  );
}