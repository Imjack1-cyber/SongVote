'use server';

import { prisma } from '@/lib/db';
import { loginUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { logger } from '@/lib/logger';

export async function handleLogin(formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    // Log the attempt (redacting password automatically via logger config, but strict manual check here)
    // We log the IP/User Agent implicitly if we had request context, but here we log the username target.
    logger.info({ username }, 'Login Attempt Initiated');

    if (!username || !password) {
        logger.warn({ username }, 'Login Failed: Missing Credentials');
        redirect('/login?error=Missing credentials');
    }

    let user = await prisma.host.findUnique({
      where: { username }
    });

    // 1. Auto-Register if username doesn't exist
    if (!user) {
        logger.info({ username }, 'Auto-Registering New Host');
        const hashedPassword = await bcrypt.hash(password, 12);
        try {
            user = await prisma.host.create({
                data: {
                    username,
                    passwordHash: hashedPassword,
                    settings: { create: {} }
                }
            });
            logger.info({ userId: user.id }, 'New Host Registered Successfully');
        } catch (e) {
            logger.error({ err: e, username }, 'Registration Failed');
            redirect('/login?error=Username unavailable');
        }
    }

    // 2. CHECK MODERATION STATUS (Strict Block)
    if (user.isBanned) {
        logger.warn({ userId: user.id, username }, 'Login Blocked: Banned User');
        redirect('/login?error=Account suspended by administrator');
    }

    if (user.deletedAt) {
        logger.warn({ userId: user.id, username }, 'Login Blocked: Deleted Account');
        redirect('/login?error=Account has been deleted');
    }

    // 3. Verify Password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
        logger.warn({ userId: user.id, username }, 'Login Failed: Invalid Password');
        redirect('/login?error=Invalid credentials'); 
    }

    // 4. Set Cookie
    await loginUser(user.id, user.username);
    
    logger.info({ userId: user.id }, 'Login Successful');
    
    // 5. Redirect
    redirect(`/${user.username}`);
}