import { logger } from './logger';

export interface CandidateSong {
    id: string;
    title: string;
    artist: string;
    albumArtUrl: string | null;
    playCount: number;
    reactionCount: number; // This is the primary metric boosted by the Graph
}

export interface HistoryItem {
    songId: string;
}

const COOLDOWN_HISTORY_LIMIT = 15; // Don't play songs from the last 15 tracks
const BASE_WEIGHT = 1.0;

/**
 * Calculates the probability score for a track.
 * Formula: Base + (PlayCount * 0.05) + (ReactionCount * 0.15)
 * 
 * Context:
 * - Graph Associations inject an artificial boost into 'ReactionCount'.
 * - If Graph Weight is 5, ReactionCount increases by 10.
 * - This results in +1.5 added to the Weight Score (10 * 0.15).
 * - This significantly increases the chance of selection vs random tracks.
 */
function calculateSongWeight(song: CandidateSong): number {
    const playWeight = song.playCount * 0.05;
    const reactionWeight = song.reactionCount * 0.15;
    
    // Add weights, ensuring it never drops below the base chance
    return Math.max(BASE_WEIGHT, BASE_WEIGHT + playWeight + reactionWeight);
}

/**
 * The Smart Radio Engine.
 * Selects the next song using a weighted probability algorithm.
 */
export function selectSmartTrack(
    sessionId: string,
    candidates: CandidateSong[], 
    history: HistoryItem[]
): CandidateSong | null {
    if (candidates.length === 0) return null;

    // 1. EXTRACT COOLDOWN IDS
    // Get the last N played songs to prevent immediate repetition
    const recentHistory = history.slice(0, COOLDOWN_HISTORY_LIMIT);
    const recentIds = new Set(recentHistory.map(h => h.songId));

    // 2. FILTER CANDIDATES
    let validPool = candidates.filter(song => !recentIds.has(song.id));

    // FAILSAFE: If the pool is exhausted due to cooldowns, ignore cooldowns.
    if (validPool.length === 0) {
        logger.warn({ 
            sessionId, 
            candidateCount: candidates.length 
        }, 'Smart Radio: Cooldown pool exhausted. Falling back to full playlist.');
        validPool = candidates;
    }

    // EDGE CASE: Exact match
    if (validPool.length === 1) return validPool[0];

    // 3. SCORE CANDIDATES
    const weightedPool = validPool.map(song => ({
        song,
        weight: calculateSongWeight(song)
    }));

    // 4. WEIGHTED SELECTION ALGORITHM
    const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
    const randomRoll = Math.random() * totalWeight;

    let currentWeight = 0;
    let selectedSong: CandidateSong | null = null;
    let selectedWeight = 0;

    for (const item of weightedPool) {
        currentWeight += item.weight;
        if (randomRoll <= currentWeight) {
            selectedSong = item.song;
            selectedWeight = item.weight;
            break;
        }
    }

    // Failsafe for floating point precision
    if (!selectedSong) {
        const lastItem = weightedPool[weightedPool.length - 1];
        selectedSong = lastItem.song;
        selectedWeight = lastItem.weight;
    }

    // 5. OBSERVABILITY
    logger.info({
        source: 'smart_radio',
        sessionId,
        selectedSongId: selectedSong.id,
        selectedSongTitle: selectedSong.title,
        metrics: {
            poolSize: validPool.length,
            totalWeight: parseFloat(totalWeight.toFixed(2)),
            winningWeight: parseFloat(selectedWeight.toFixed(2)),
            graphBoost: selectedSong.reactionCount // Logs the boosted value
        }
    }, 'Smart Radio Track Selected');

    return selectedSong;
}