import { loginGuest } from '@/app/actions';
import { Radio } from 'lucide-react';
import Link from 'next/link';

export default function GuestJoinPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      
      <div className="mb-8 text-center">
        <Link href="/" className="flex items-center justify-center gap-2 font-bold text-xl text-slate-900 mb-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Radio className="w-5 h-5" />
          </div>
          SongVote
        </Link>
        <h1 className="text-2xl font-bold">Join a Session</h1>
        <p className="text-slate-500">Enter the credentials from your access card.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
        
        {searchParams.error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center font-medium">
              {searchParams.error}
            </div>
        )}

        <form action={loginGuest} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-700">Username</label>
            <input 
              name="username" 
              type="text" 
              placeholder="e.g. RedFox42"
              required 
              className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono font-bold uppercase" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-700">Passcode</label>
            <input 
              name="password" 
              type="text" 
              pattern="[0-9]*" 
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              required 
              className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono text-2xl tracking-widest" 
            />
          </div>

          <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30">
            Join Session
          </button>
        </form>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400 max-w-xs">
        Don't have a code? Ask the event host to generate a guest pass for you.
      </p>
    </div>
  );
}