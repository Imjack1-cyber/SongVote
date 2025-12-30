// ========================================================================
// FILE: app/(site)/page.tsx
// ========================================================================

import Link from 'next/link';
import { PlayCircle, Users, BarChart3, Radio } from 'lucide-react';
import { createDemoSession } from '@/app/actions';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100">
      
      <nav className="w-full px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Radio className="w-5 h-5" />
          </div>
          SongVote
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 py-2">
            Login
          </Link>
          <Link href="/login" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition">
            Get Started
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        <section className="pt-20 pb-32 px-6 text-center max-w-4xl mx-auto">
          <div className="inline-block px-3 py-1 mb-6 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold tracking-wide uppercase">
            v2.0 Public Beta
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6">
            Let the crowd <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              control the music.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            The ultimate real-time playlist voting platform for streamers, events, and parties. 
            Engage your audience instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/login" className="btn-primary text-base">
              Start a Session
            </Link>
            <form action={createDemoSession}>
                <button type="submit" className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition">
                    <PlayCircle className="w-4 h-4 mr-2" />
                    View Demo
                </button>
            </form>
          </div>
        </section>

        <section className="bg-white py-24 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Radio className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Real-time Sync</h3>
                <p className="text-slate-500 leading-relaxed">
                  Votes update instantly across all devices using WebSockets. No refreshing required.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Audience First</h3>
                <p className="text-slate-500 leading-relaxed">
                  Designed for Twitch, YouTube Live, and house parties. Simple QR code access for guests.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Analytics</h3>
                <p className="text-slate-500 leading-relaxed">
                  See which genres your audience loves. Track user engagement and voting trends.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-50 py-12 text-center text-slate-400 text-sm border-t border-slate-200">
        <p>&copy; {new Date().getFullYear()} SongVote Inc.</p>
      </footer>
    </div>
  );
}