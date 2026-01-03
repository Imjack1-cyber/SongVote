import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { randomBytes } from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateVoteId() {
  // Use crypto.randomBytes for secure ID generation
  // 16 bytes converted to hex results in a 32-character string
  return randomBytes(16).toString('hex');
}