// ========================================================================
// FILE: app/(site)/login/LoginForm.tsx
// ========================================================================

'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Define the shape of the props
interface LoginFormProps {
  action: (formData: FormData) => Promise<void>;
}

export default function LoginForm({ action }: LoginFormProps) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <form action={action} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-700">Username</label>
            <input 
              name="username" 
              type="text" 
              required 
              placeholder="Choose a unique handle"
              className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-700">Password</label>
            <div className="relative">
                <input 
                  name="password" 
                  type={showPassword ? "text" : "password"}
                  required 
                  placeholder="••••••••"
                  className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition pr-10" 
                />
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition"
                    title={showPassword ? "Hide password" : "Show password"}
                >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>
          </div>
          <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30">
            Sign In / Register
          </button>
        </form>
    );
}