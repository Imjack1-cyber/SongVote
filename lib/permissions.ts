import { prisma } from './db';

export type PermissionType = 'controlPlayer' | 'forcePlay' | 'manageQueue' | 'manageUsers' | 'printCards';

export interface Permissions {
    controlPlayer: boolean;
    forcePlay: boolean;
    manageQueue: boolean;
    manageUsers: boolean;
    printCards: boolean;
}

export const DEFAULT_PERMISSIONS: Permissions = {
    controlPlayer: false,
    forcePlay: false,
    manageQueue: false,
    manageUsers: false,
    printCards: false
};

export async function checkPermission(sessionId: string, guestId: string | undefined, permission: PermissionType): Promise<boolean> {
    const session = await prisma.voteSession.findUnique({
        where: { id: sessionId },
    });

    if (!session) return false;

    // 1. Is it the Host?
    if (session.hostId === guestId) return true;

    // 2. Is it a Guest?
    if (guestId) {
        const guest = await prisma.guestAccount.findUnique({
            where: { id: guestId }
        });

        if (!guest) return false;
        if (guest.isBanned) return false;

        const userPerms = guest.permissions as unknown as Permissions | null;
        if (userPerms && userPerms[permission] !== undefined) {
            return userPerms[permission];
        }

        const defaultPerms = session.defaultPermissions as unknown as Permissions | null;
        if (defaultPerms && defaultPerms[permission] !== undefined) {
            return defaultPerms[permission];
        }
    }

    return DEFAULT_PERMISSIONS[permission];
}