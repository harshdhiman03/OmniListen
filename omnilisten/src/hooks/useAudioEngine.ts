import { useAudioPlayer } from '@/contexts/AudioPlayerContext';

/**
 * Global audio engine hook. Safely intercepts context states and triggers
 * stop/teardown commands on underlying HTMLAudioElements. Falls back gracefully 
 * if used outside of the AudioPlayerProvider scope.
 */
export function useAudioEngine() {
    try {
        const audioPlayer = useAudioPlayer();
        return {
            stopAll: () => {
                if (audioPlayer && typeof audioPlayer.stopAll === 'function') {
                    audioPlayer.stopAll();
                }
            }
        };
    } catch (e) {
        // Safe context fallback for header/sidebar unattached buttons
        return {
            stopAll: () => {
                if (typeof window !== 'undefined') {
                    const audios = document.querySelectorAll('audio');
                    audios.forEach((audio) => {
                        try {
                            audio.pause();
                            audio.src = "";
                        } catch (err) {
                            console.error("Failed to teardown fallback audio element:", err);
                        }
                    });
                }
            }
        };
    }
}
