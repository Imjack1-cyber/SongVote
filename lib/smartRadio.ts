import { logger } from './logger';

export interface CandidateSong {
    id: string;
    title: string;
    artist: string;
    albumArtUrl: string | null;
    playCount: number;
    reactionCount: number;
}

export interface HistoryItem {
    songId: string;
}

const COOLDOWN_HISTORY_LIMIT = 15; // Don't play songs from the last 15 tracks
const BASE_WEIGHT = 1.0;

/**
 * Calculates the engagement score for a track.
 * Formula: Base + (PlayCount * 0.05) + (ReactionCount * 0.15)
 */
function calculateSongWeight(song: CandidateSong): number {
    const playWeight = song.playCount * 0.05;
    const reactionWeight = song.reactionCount * 0.15;
    
    // Add weights, ensuring it never drops below the base chance
    return Math.max(BASE_WEIGHT, BASE_WEIGHT + playWeight + reactionWeight);
}

/**
 * The Smart Radio Engine.
 * Selects the next song using a weighted probability algorithm based on user engagement.
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

    // FAILSAFE: If the playlist is very small and everything is on cooldown, 
    // ignore the cooldown rules rather than stopping the music.
    if (validPool.length === 0) {
        logger.warn({ 
            sessionId, 
            candidateCount: candidates.length 
        }, 'Smart Radio: Cooldown pool exhausted. Falling back to full playlist.');
        validPool = candidates;
    }

    // EDGE CASE: If the pool has exactly 1 song, just return it.
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

    // Failsafe in case of floating point precision errors
    if (!selectedSong) {
        selectedSong = weightedPool[weightedPool.length - 1].song;
        selectedWeight = weightedPool[weightedPool.length - 1].weight;
    }

    // 5. OBSERVABILITY
    // Log the decision-making data for debugging/analytics
    logger.info({
        source: 'smart_radio',
        sessionId,
        selectedSongId: selectedSong.id,
        selectedSongTitle: selectedSong.title,
        metrics: {
            poolSize: validPool.length,
            totalWeight: parseFloat(totalWeight.toFixed(2)),
            winningWeight: parseFloat(selectedWeight.toFixed(2)),
            playCount: selectedSong.playCount,
            reactionCount: selectedSong.reactionCount
        }
    }, 'Smart Radio Track Selected');

    return selectedSong;
}