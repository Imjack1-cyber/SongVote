'use client';

import { useFormStatus } from 'react-dom';
import { Spinner } from '@/components/ui/Loaders';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  icon?: LucideIcon;
}

export default function SubmitButton({ 
  children, 
  loadingText = "Processing...", 
  className, 
  icon: Icon,
  ...props 
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={cn("btn-primary flex items-center justify-center gap-2 transition-all", className)}
      {...props}
    >
      {pending ? (
        <>
          <Spinner className="text-current opacity-80" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4" />}
          {children}
        </>
      )}
    </button>
  );
}