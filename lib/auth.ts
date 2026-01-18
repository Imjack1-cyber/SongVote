import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
const ALG = 'HS256';

export async function signSession(payload: { userId: string; username: string }) {
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
  return jwt;
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: string; username: string };
  } catch (e) {
    return null;
  }
}

export async function getCurrentUser() {
  const token = cookies().get('session_token')?.value;
  if (!token) return null;
  return await verifySession(token);
}

export async function loginUser(userId: string, username: string) {
  const token = await signSession({ userId, username });
  
  const isSecure = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') ?? false;

  cookies().set('session_token', token, {
    httpOnly: true,
    secure: isSecure, 
    sameSite: 'lax',
    path: '/',
  });
}

export async function logoutUser() {
  cookies().delete('session_token');
}