import Link from 'next/link';
import { Heart } from 'lucide-react';

export default function Footer({ hostName }: { hostName?: string }) {
  return (
    // layout-footer applies: border-t, bg-surface, mt-auto
    <footer className="layout-footer py-8 text-[var(--foreground)]">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">

          <div className="flex items-center gap-6 text-sm font-medium opacity-70">
             {hostName && (
                <Link href={`/${hostName}`} className="hover:text-[var(--accent)] transition-colors">
                    Dashboard
                </Link>
             )}
             <Link href="/" className="hover:text-[var(--accent)] transition-colors">
                Home
            </Link>
            <span className="opacity-20">|</span>
            <div className="flex items-center gap-1">
                <span>Made with</span>
                <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                <span>by SongVote</span>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}