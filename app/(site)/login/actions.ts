'use server';

import { prisma } from '@/lib/db';
import { loginUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';

export async function handleLogin(formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) {
        redirect('/login?error=Missing credentials');
    }

    let user = await prisma.host.findUnique({ where: { username } });

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
    if (!isValid) redirect('/login?error=Invalid credentials');

    await loginUser(user.id, user.username);
    redirect(`/${user.username}`);
}