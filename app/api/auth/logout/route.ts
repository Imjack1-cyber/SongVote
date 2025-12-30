import { logoutUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function POST() {
  await logoutUser();
  redirect('/');
}