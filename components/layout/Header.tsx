'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Settings, LogOut, LayoutGrid, Music, Moon, Sun, LifeBuoy } from 'lucide-react';
import { toggleDarkMode, getUnreadTicketCount } from '@/app/actions';
import { useSocket } from '@/hooks/useSocket';
import { useEffect, useState } from 'react';

interface HeaderProps {
  hostName: string;
  isLoggedIn: boolean;
  currentUser?: string;
}

export default function Header({ hostName, isLoggedIn, currentUser }: HeaderProps) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;
  
  const { socket } = useSocket('global-notifications'); 
  const [unreadCount, setUnreadCount] = useState(0);

  const handleToggle = async () => {
    await toggleDarkMode(hostName);
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    // Initial fetch
    getUnreadTicketCount().then(setUnreadCount);

    if (!socket) return;

    // Handler for Host Notifications
    const handleNotification = (data: any) => {
        console.log('[DEBUG] Header received notification:', data);
        if (data.type === 'TICKET_REPLY' || data.type === 'TICKET_STATUS') {
            setUnreadCount(prev => prev + 1);
        }
    };

    // Handler for Admin Notifications
    const handleAdminNotification = (data: any) => {
        console.log('[DEBUG] Header received ADMIN notification:', data);
        if (data.type === 'NEW_TICKET' || data.type === 'TICKET_REPLY') {
            setUnreadCount(prev => prev + 1);
        }
    };

    socket.on('ticket-notification', handleNotification);
    socket.on('admin-notification', handleAdminNotification);

    return () => { 
        socket.off('ticket-notification', handleNotification);
        socket.off('admin-notification', handleAdminNotification);
    };
  }, [socket, isLoggedIn]);
  
  return (
    <header className="layout-header h-16 transition-colors duration-300">
      <div className="max-w-7xl mx-auto h-full px-4 md:px-8 flex items-center justify-between">
        
        <Link href={`/${hostName}`} className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
              <Music className="w-5 h-5" />
            </div>
            <div className="flex flex-col leading-none">
                <span className="font-bold text-lg tracking-tight">{hostName}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">SongVote</span>
            </div>
        </Link>

        <nav className="flex items-center gap-1 md:gap-2">
          
          {isLoggedIn && (
            <button 
                id="theme-toggle"
                onClick={handleToggle}
                className="p-2 rounded-lg text-[var(--foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--foreground)]/5 transition-all mr-1"
                title="Toggle Dark Mode"
            >
                <Sun className="w-5 h-5 hidden dark:block" />
                <Moon className="w-5 h-5 block dark:hidden" />
            </button>
          )}

          <Link 
            id="nav-overview"
            href={`/${hostName}`} 
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive(`/${hostName}`) 
                ? 'bg-[var(--foreground)]/5 text-[var(--accent)]' 
                : 'hover:bg-[var(--foreground)]/5 opacity-70 hover:opacity-100'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden md:inline">Dashboard</span>
          </Link>

          {isLoggedIn ? (
            <>
              <div className="w-px h-5 bg-[var(--border)] mx-1 hidden md:block" />
              
              <Link 
                id="nav-settings" 
                href={`/${hostName}/settings`} 
                className={`p-2 md:px-3 md:py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  isActive(`/${hostName}/settings`) 
                    ? 'bg-[var(--foreground)]/5 text-[var(--accent)]' 
                    : 'hover:bg-[var(--foreground)]/5 opacity-70 hover:opacity-100'
                }`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden md:inline">Settings</span>
              </Link>

              <Link 
                id="nav-support" 
                href={`/${hostName}/support`} 
                className={`p-2 md:px-3 md:py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 relative ${
                  isActive(`/${hostName}/support`) 
                    ? 'bg-[var(--foreground)]/5 text-[var(--accent)]' 
                    : 'hover:bg-[var(--foreground)]/5 opacity-70 hover:opacity-100'
                }`}
                title="Support"
                onClick={() => setUnreadCount(0)} // Optimistic clear
              >
                <div className="relative">
                    <LifeBuoy className="w-4 h-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--surface)]" />
                    )}
                </div>
                <span className="hidden md:inline">Help</span>
              </Link>

              <Link 
                id="nav-profile"
                href={`/${hostName}/profile`} 
                className={`p-2 md:px-3 md:py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  isActive(`/${hostName}/profile`) 
                    ? 'bg-[var(--foreground)]/5 text-[var(--accent)]' 
                    : 'hover:bg-[var(--foreground)]/5 opacity-70 hover:opacity-100'
                }`}
                title="Profile"
              >
                <User className="w-4 h-4" />
                <span className="hidden md:inline">Profile</span>
              </Link>

              <form action="/api/auth/logout" method="POST" className="ml-1">
                <button 
                  type="submit" 
                  className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
             <Link href="/login" className="ml-4 btn-primary">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}