// ========================================================================
// FILE: app/(site)/login/page.tsx
// ========================================================================

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { loginUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import Link from 'next/link';
import { ArrowLeft, Radio } from 'lucide-react';
import LoginForm from './LoginForm'; 

// Server Action defined in the Server Component
async function handleLogin(formData: FormData) {
    'use server';
    
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) {
        redirect('/login?error=Missing credentials');
    }

    let user = await prisma.host.findUnique({
      where: { username }
    });

    if (!user) {
        const hashedPassword = await bcrypt.hash(password, 12);
        try {
            user = await prisma.host.create({
                data: {
                    username,
                    passwordHash: hashedPassword,
                    settings: { create: {} }
                }
            });
        } catch (e) {
            redirect('/login?error=Username unavailable');
        }
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
        redirect('/login?error=Invalid credentials'); 
    }

    await loginUser(user.id, user.username);
    redirect(`/${user.username}`);
}

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="absolute top-8 left-8">
        <Link href="/" className="flex items-center text-slate-500 hover:text-slate-900 transition">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
      </div>

      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
        <div className="mb-8 text-center">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white mx-auto mb-4">
                <Radio className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Host Access</h2>
            <p className="text-slate-500 mt-2">
                Log in or enter a new username to <strong>automatically register</strong>.
            </p>
        </div>

        {searchParams.error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center font-medium">
              {searchParams.error}
            </div>
        )}

        {/* Pass the Server Action to the Client Component */}
        <LoginForm action={handleLogin} />
        
        <p className="mt-8 text-center text-xs text-slate-400">
          Passwords are encrypted using bcrypt. <br/>
          YouTube API Keys are AES-256 encrypted.
        </p>
      </div>
    </div>
  );
}