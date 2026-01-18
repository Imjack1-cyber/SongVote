import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.songvote.app',
  appName: 'SongVote',
  webDir: 'public', 
  server: {
    // UPDATED: No port 3000
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.0.109',
    cleartext: true,
    allowNavigation: [
      "*.youtube.com",
      "*.youtu.be",
      "*.googlevideo.com",
      "*.ytimg.com"
    ]
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;