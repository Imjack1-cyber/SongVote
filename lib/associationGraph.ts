import { prisma } from './db';
import { logger } from './logger';
import { CandidateSong } from './smartRadio';

/**
 * DATA INGESTION (Learning)
 * Records a transition between two songs (Source -> Target).
 */
export async function recordAssociation(sourceSongId: string | null, targetSongId: string | null) {
    // 1. Validation: We need two distinct songs to form a link
    if (!sourceSongId || !targetSongId || sourceSongId === targetSongId) return;

    const start = Date.now();

    try {
        // 2. Execution: Upsert the edge in the graph
        await prisma.songAssociation.upsert({
            where: {
                sourceSongId_targetSongId: {
                    sourceSongId,
                    targetSongId
                }
            },
            update: {
                weight: { increment: 1 },
                updatedAt: new Date()
            },
            create: {
                sourceSongId,
                targetSongId,
                weight: 1
            }
        });
        
        logger.debug({ 
            source: 'association_graph', 
            sourceSongId, 
            targetSongId,
            duration: Date.now() - start 
        }, 'Graph Edge Learned');

    } catch (e) {
        // Non-critical error, log and move on to prevent impacting playback
        logger.warn({ err: e, source: 'association_graph' }, 'Failed to record association');
    }
}

/**
 * RETRIEVAL ENGINE (Graph Query)
 * Retrieves songs strongly associated with the seed song.
 * 
 * Logic:
 * 1. Find edges starting from seedSongId.
 * 2. Sort by weight descending (strongest links first).
 * 3. Map to CandidateSong format for the Smart Radio engine.
 * 4. Apply "Artificial Reaction Boost" based on weight.
 */
export async function getAssociatedTracks(seedSongId: string, limit: number = 5): Promise<CandidateSong[]> {
    const start = Date.now();

    try {
        const associations = await prisma.songAssociation.findMany({
            where: { sourceSongId: seedSongId },
            orderBy: { weight: 'desc' },
            take: limit,
            include: {
                targetSong: true
            }
        });

        if (associations.length === 0) return [];

        const results = associations.map(assoc => {
            // SCORING ALGORITHM:
            // We want the Smart Radio to favor these tracks heavily.
            // We map the 'weight' (frequency of transition) to 'reactionCount'.
            // A weight of 1 (happened once) adds +2 reaction points.
            // A weight of 5 (happened 5 times) adds +10 reaction points.
            const boostedReactionCount = assoc.targetSong.reactionCount + (assoc.weight * 2);

            return {
                id: assoc.targetSong.id,
                title: assoc.targetSong.title,
                artist: assoc.targetSong.artist,
                albumArtUrl: assoc.targetSong.albumArtUrl,
                playCount: assoc.targetSong.playCount,
                reactionCount: boostedReactionCount
            };
        });

        logger.debug({ 
            source: 'association_graph', 
            seedSongId, 
            resultsFound: results.length,
            duration: Date.now() - start
        }, 'Graph Query Completed');

        return results;

    } catch (e) {
        logger.error({ err: e, seedSongId }, 'Failed to fetch associations');
        return [];
    }
}