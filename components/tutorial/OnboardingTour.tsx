'use client';

import { useEffect, useRef, useState } from 'react';
import { driver, DriveStep } from 'driver.js';
import "driver.js/dist/driver.css";
import { usePathname, useRouter, useParams } from 'next/navigation';
import { completeTutorial } from '@/app/actions';
import { useSocket } from '@/hooks/useSocket';

interface OnboardingTourProps {
  isHost: boolean;
  tutorialCompleted: boolean;
  hostName: string;
}

export default function OnboardingTour({ isHost, tutorialCompleted, hostName }: OnboardingTourProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const driverObj = useRef<any>(null);
  const isNavigating = useRef(false);
  const [mounted, setMounted] = useState(false);

  // Get Session ID for reactions (if on session page)
  const voteId = typeof params?.voteId === 'string' ? params.voteId : '';
  const { socket } = useSocket(voteId || '');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isHost || tutorialCompleted) return;

    let currentStepIndex = parseInt(localStorage.getItem('songvote_tour_step') || '0');
    isNavigating.current = false;

    // --- HELPER: DISABLE CLICKS ON HIGHLIGHTED ELEMENT ---
    const disableClicks = (element?: Element) => {
        if (element instanceof HTMLElement) element.style.pointerEvents = 'none';
    };
    
    const enableClicks = (element?: Element) => {
        if (element instanceof HTMLElement) element.style.pointerEvents = '';
    };

    // --- STEPS DEFINITION ---
    const steps: DriveStep[] = [
        // 0-1
        { element: '#dashboard-header', popover: { title: 'Welcome to SongVote! 👋', description: 'Hi there! This mandatory tutorial will show you everything you need to know.' } },
        { element: '#nav-settings', popover: { title: 'Setup Required', description: 'You need to set up a YouTube API key first. Click Settings.', onNextClick: () => {
            isNavigating.current = true;
            localStorage.setItem('songvote_tour_step', '2');
            router.push(`/${hostName}/settings`);
        } } },
        
        // 2-5
        { element: '#youtube-help-text', popover: { title: 'Global Settings', description: 'This is the main settings page.' } },
        { element: '#youtube-help-box', popover: { title: 'Get Your Key', description: 'Follow instructions here to get your API Key.' } },
        { element: '#youtube-api-input', popover: { title: 'Enter Key', description: 'Enter it here (it is encrypted!). Click Next only after entering it.' } },
        { element: '#save-youtube-btn', popover: { title: 'Save API Key', description: 'Click Save! You must save the key before creating playlists.' } },

        // 6-8
        { element: '#library-section', popover: { title: 'Music Library', description: 'After the key is set, you can see your playlists here.' } },
        { element: '#playlist-create-input', popover: { title: 'Create Collection', description: 'Type a name to create a local playlist.' } },
        { element: '#playlist-create-btn', popover: { title: 'Confirm', description: 'Click Create to save your playlist.' } },
        
        // 9
        { element: '#import-btn-toggle', popover: { title: 'Import Songs', description: 'Click here (or click Next) to switch to bulk import mode.', onNextClick: () => {
            const btn = document.getElementById('import-btn-toggle');
            if (btn) btn.click();
            currentStepIndex++;
            localStorage.setItem('songvote_tour_step', currentStepIndex.toString());
            driverObj.current.drive(currentStepIndex);
        } } },
        
        // 10
        { element: '#import-section', popover: { title: 'Import Songs', description: 'You can manually import text lists or Spotify copy-pastes here.' } },

        // 11-13
        { element: '#appearance-section', popover: { title: 'Appearance', description: 'Toggle Light/Dark theme and branding here.' } },
        { element: '#save-appearance-btn', popover: { title: 'Save', description: 'Don\'t forget to click save!' } },
        { element: '#theme-toggle', popover: { title: 'Quick Toggle', description: 'Toggle theme instantly here.' } },

        // 14
        { element: '#nav-profile', popover: { title: 'Profile', description: 'Let\'s check your profile. Click here.', onNextClick: () => {
            isNavigating.current = true;
            localStorage.setItem('songvote_tour_step', '15'); 
            router.push(`/${hostName}/profile`);
        } } },

        // 15-16
        { element: '#profile-info', popover: { title: 'Account Info', description: 'View your account details here.' } },
        { element: '#profile-branding', popover: { title: 'Avatar', description: 'Set your profile picture/favicon here.' } },

        // 17
        { element: '#nav-overview', popover: { title: 'Back to Dashboard', description: 'Let\'s go back to the dashboard.', onNextClick: () => {
            isNavigating.current = true;
            localStorage.setItem('songvote_tour_step', '18'); 
            router.push(`/${hostName}`);
        } } },

        // 18-19
        { element: '#create-session-input', popover: { title: 'Name Your Party', description: 'Enter a session name here.' } }, 
        { element: '#create-session-btn', popover: { title: 'Launch', description: 'Click to create your session.', onNextClick: () => {
            localStorage.setItem('songvote_tour_step', '20'); 
        } } },

        // 20
        { popover: { title: 'Magic Happens Here ✨', description: 'This is the session player page.' } },
        
        // 21
        { element: '#session-settings-link', popover: { title: 'Session Settings', description: 'Let\'s configure this session first.', onNextClick: () => {
            const link = document.getElementById('session-settings-link') as HTMLAnchorElement;
            if(link) {
                isNavigating.current = true;
                localStorage.setItem('songvote_tour_step', '22'); 
                router.push(link.href);
            }
        } } },

        // 22-35
        { element: '#session-rules-form', popover: { title: 'Settings', description: 'Configure settings specific to this session here.' } },
        { element: '#user-list-table', popover: { title: 'User Manager', description: 'See connected users, permissions, and timers.' } },
        { element: '#reset-timer-btn', popover: { title: 'Reset Timers', description: 'Reset voting timers for everyone or specific users.' } },
        { element: '#clear-session-btn', popover: { title: 'Clear Queue', description: 'Wipe the queue and history.' } },
        { element: '#session-rules', popover: { title: 'Rules', description: 'Define the rules here.' } },
        { element: '#toggle-hype', popover: { title: 'Hype Reactions', description: 'Enable floating emojis for users.' } },
        { element: '#toggle-dupe', popover: { title: 'Anti-Duplicate', description: 'Prevent duplicate songs (2hr window).' } },
        { element: '#toggle-region', popover: { title: 'Region Check', description: 'Block region-locked songs.' } },
        { element: '#input-votes-per-user', popover: { title: 'Vote Limit', description: 'Votes per user per round.' } },
        { element: '#input-cycle-delay', popover: { title: 'Cooldown', description: 'Delay between voting rounds (0 = none).' } },
        { element: '#input-start-time', popover: { title: 'Auto Start', description: 'Schedule start time.' } },
        { element: '#toggle-verify', popover: { title: 'Verification', description: 'Require manual approval for songs.' } },
        { element: '#radio-config-container', popover: { title: 'Smart Radio', description: 'Choose fallback music when queue is empty.' } },
        { element: '#auto-save-select', popover: { title: 'Auto-Save', description: 'Save played songs to a playlist automatically.' } },
        { element: '#save-session-settings-btn', popover: { title: 'Save Rules', description: 'Don\'t forget to save!' } },

        // 36-41
        { element: '#analytics-section', popover: { title: 'Analytics', description: 'See voting stats.' } },
        { element: '#history-section', popover: { title: 'History', description: 'View played songs.' } },
        { element: '#history-section button', popover: { title: 'Export', description: 'Export history to CSV.' } }, 
        { element: '#api-status-card', popover: { title: 'API Status', description: 'Check if your key is working.' } },
        { element: '#leaderboard-section', popover: { title: 'Leaderboard', description: 'Top contributing guests.' } },
        { element: '#blacklist-section', popover: { title: 'Blacklist', description: 'Block specific songs or keywords.' } },

        // 42-45
        { element: '#guest-management', popover: { title: 'Guest Access', description: 'Manage guest accounts.' } },
        { element: '#guest-count-input', popover: { title: 'Create Accounts', description: 'Enter number of guests here.' } },
        { element: '#guest-add-btn', popover: { title: 'Add Guests', description: 'Click Add to generate codes.' } }, 
        { element: '.guest-ban-btn', popover: { title: 'Block Access', description: 'Click the Ban icon to block a user.' } }, 
        
        // 46
        { element: '#print-cards-btn', popover: { title: 'Print Cards', description: 'Click to print QR cards.', onNextClick: () => {
            const link = document.getElementById('print-cards-btn') as HTMLAnchorElement;
            if(link) {
                isNavigating.current = true;
                localStorage.setItem('songvote_tour_step', '47'); 
                window.open(link.href, '_self');
            }
        }} },

        // 47-49 (Print Preview)
        { element: '#print-preview-wrapper', popover: { title: 'Preview', description: 'This shows how your guest cards will look on paper.' } },
        { element: '#print-controls', popover: { title: 'Customize', description: 'Adjust layout settings (Desktop only).' } },
        { 
            element: window.innerWidth < 768 ? '#print-back-mobile' : '#print-back-desktop', 
            popover: { 
                title: 'Go Back', 
                description: 'Let\'s return to settings.', 
                side: 'top', 
                onNextClick: () => {
                    isNavigating.current = true;
                    localStorage.setItem('songvote_tour_step', '50');
                    router.back();
                } 
            } 
        },

        // 50
        { element: '#back-to-player-btn', popover: { title: 'Return to Player', description: 'Settings done. Let\'s go back.', onNextClick: () => {
             const link = document.getElementById('back-to-player-btn') as HTMLAnchorElement;
             if(link) {
                 isNavigating.current = true;
                 localStorage.setItem('songvote_tour_step', '51');
                 router.push(link.href);
             }
        }} },

        // 51-53
        { element: '#print-cards-btn', popover: { title: 'Quick Print', description: 'Shortcut to print page.' } }, 
        { element: '#visualizer-btn', popover: { title: 'Visualizer', description: 'Open TV mode.' } },
        { element: '#qr-btn', popover: { title: 'QR Code', description: 'Show Join Code overlay.' } },
        
        // 54 (DISABLED INTERACTION)
        { 
            element: '#qr-btn', // Step 54
            popover: { title: 'QR Code', description: 'Show Join Code overlay.' },
            onHighlightStarted: disableClicks,
            onDeselected: enableClicks
        },
        
        // 55 (DISABLED INTERACTION)
        { 
            element: '#share-btn', // Step 55
            popover: { title: 'Share Link', description: 'Copy link to clipboard.' },
            onHighlightStarted: disableClicks,
            onDeselected: enableClicks
        }, 
        
        // 56-61
        { element: '#song-search-input', popover: { title: 'Search', description: 'Search for songs here. Checks library + YouTube.' } },
        { element: '#search-results', popover: { title: 'Results', description: 'Click + to add found songs.' } },
        { element: '#host-player', popover: { title: 'The Player', description: 'Main playback area.' } },
        { element: '#close-video-btn', popover: { title: 'Hide Video', description: 'Close video, keep audio.' } },
        { element: '#reset-player-btn', popover: { title: 'Reset', description: 'Fix playback glitches.' } },
        { element: '#force-play-btn', popover: { title: 'Force Play', description: 'Force a URL to play immediately.' } },
        
        // 62 (DISABLED INTERACTION)
        { 
            element: '#host-player', // Step 62
            popover: { title: 'Controls', description: 'Standard controls are self-explanatory.' },
            onHighlightStarted: disableClicks,
            onDeselected: enableClicks
        },
        
        // 63-64
        { element: '#up-next-list', popover: { title: 'Up Next', description: 'See queue and pending suggestions.' } },
        { element: '#played-history-list', popover: { title: 'History', description: 'Recently played tracks.' } },
        
        // 65 (FINAL - WITH CELEBRATION)
        { 
            element: '#app-footer', 
            popover: { 
                title: 'Done!', 
                description: 'Thanks for reading! Enjoy your music.', 
                onNextClick: () => {
                    if (socket && voteId) {
                        socket.emit('send-reaction', { sessionId: voteId, type: 'heart', voterId: 'HOST' });
                        setTimeout(() => socket.emit('send-reaction', { sessionId: voteId, type: 'party', voterId: 'HOST' }), 200);
                        setTimeout(() => socket.emit('send-reaction', { sessionId: voteId, type: 'fire', voterId: 'HOST' }), 400);
                        setTimeout(() => socket.emit('send-reaction', { sessionId: voteId, type: 'heart', voterId: 'HOST' }), 600);
                        setTimeout(() => socket.emit('send-reaction', { sessionId: voteId, type: 'party', voterId: 'HOST' }), 800);
                    }

                    completeTutorial();
                    localStorage.removeItem('songvote_tour_step');
                    driverObj.current.destroy();
                }
            } 
        }
    ];

    // --- RESUME LOGIC ---
    let shouldRedirect = false;
    let targetPath = '';

    if (pathname === `/${hostName}`) {
        if (currentStepIndex >= 2 && currentStepIndex <= 13) { shouldRedirect = true; targetPath = `/${hostName}/settings`; }
        else if (currentStepIndex >= 14 && currentStepIndex <= 16) { shouldRedirect = true; targetPath = `/${hostName}/profile`; }
        else if (currentStepIndex > 19) { currentStepIndex = 0; }
    }
    else if (pathname === `/${hostName}/settings`) {
        if (currentStepIndex < 2) currentStepIndex = 2;
        else if (currentStepIndex > 13) { shouldRedirect = true; targetPath = `/${hostName}`; }
    }
    else if (pathname === `/${hostName}/profile`) {
        if (currentStepIndex < 15 || currentStepIndex > 16) currentStepIndex = 15;
    }
    else if (pathname.match(new RegExp(`^/${hostName}/[^/]+$`))) {
        if (currentStepIndex < 20) currentStepIndex = 20;
        if (currentStepIndex > 21 && currentStepIndex < 51) currentStepIndex = 51; 
    }
    else if (pathname.match(new RegExp(`^/${hostName}/[^/]+/settings$`))) {
        if (currentStepIndex < 22 || currentStepIndex > 50) currentStepIndex = 22;
    }
    else if (pathname.match(new RegExp(`^/${hostName}/[^/]+/print$`))) {
        if (currentStepIndex < 46 || currentStepIndex > 49) currentStepIndex = 46;
    }

    if (shouldRedirect) {
        router.push(targetPath);
        return;
    }

    localStorage.setItem('songvote_tour_step', currentStepIndex.toString());

    driverObj.current = driver({
        showProgress: true,
        allowClose: false,
        animate: true,
        steps: steps, 
        onNextClick: () => {
            const nextStep = currentStepIndex + 1;
            const currentDef = steps[currentStepIndex];
            
            if (currentDef && (currentDef.popover as any).onNextClick) {
                (currentDef.popover as any).onNextClick();
            } else {
                currentStepIndex = nextStep;
                localStorage.setItem('songvote_tour_step', currentStepIndex.toString());
                driverObj.current.drive(currentStepIndex); 
            }
        },
        onPrevClick: () => {
            currentStepIndex = Math.max(0, currentStepIndex - 1);
            localStorage.setItem('songvote_tour_step', currentStepIndex.toString());
            driverObj.current.drive(currentStepIndex);
        }
    });

    const interval = setTimeout(() => {
        if (isNavigating.current) return;
        if (currentStepIndex >= steps.length) {
            completeTutorial();
            return;
        }
        const stepDef = steps[currentStepIndex];
        if (stepDef) {
            const el = typeof stepDef.element === 'string' ? document.querySelector(stepDef.element) : null;
            if (typeof stepDef.element === 'string' && !el) {
                // If element missing, try next step (prevent hang)
                if (currentStepIndex < steps.length - 1) {
                    currentStepIndex++;
                    localStorage.setItem('songvote_tour_step', currentStepIndex.toString());
                    driverObj.current.drive(currentStepIndex);
                }
                return;
            }
            driverObj.current.drive(currentStepIndex);
        }
    }, 1000);

    return () => {
        clearTimeout(interval);
        if (driverObj.current) {
            driverObj.current.destroy();
        }
    };

  }, [pathname, isHost, tutorialCompleted, hostName, router, mounted, socket, voteId]);

  if (!mounted) return null;

  return null;
}