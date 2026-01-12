'use client';

import { useFormStatus } from 'react-dom';
import { Spinner } from '@/components/ui/Loaders';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  loadingText?: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
}

export function SubmitButton({ 
  children, 
  className, 
  loadingText, 
  icon: Icon,
  variant = 'primary',
  disabled,
  ...props 
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  // Base styles mirroring the project's button classes
  const baseStyles = "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
  
  const variants = {
    primary: "bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-110 shadow-sm",
    outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--foreground)]/5",
    ghost: "hover:bg-[var(--foreground)]/5",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm"
  };

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    >
      {pending ? (
        <>
          <Spinner className="mr-2 h-4 w-4" />
          {loadingText || 'Processing...'}
        </>
      ) : (
        <>
          {Icon && <Icon className="mr-2 h-4 w-4" />}
          {children}
        </>
      )}
    </button>
  );
}