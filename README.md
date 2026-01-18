# 🎵 SongVote

**Let the crowd control the music.**

SongVote is a real-time, collaborative playlist platform. A host creates a room, guests join via QR code, and everyone votes on what plays next. The highest-voted song plays automatically.

## ✨ Features

*   **Real-time Sync:** Votes, queue changes, and playback state update instantly for everyone (using Socket.IO).
*   **YouTube Integration:** Search and play millions of songs directly from YouTube.
*   **Fair Voting:** Includes rate limiting, cooldown timers, and duplicate vote prevention.
*   **Host Controls:** Skip songs, ban users, force-play tracks, and blacklist keywords.
*   **Party Mode:** A read-only "Visualizer" view optimized for TV screens.
*   **Easy Access:** Guests join via QR code or PIN—no registration required.
*   **Zero-Delay Playback:** Smart pre-loading ensures music never stops.
*   **SuperAdmin Dashboard:** A "God View" for platform owners to monitor total hosts, active sessions, and voting activity across the entire instance.
*   **PWA & Mobile:** Installable on iOS/Android. Native haptics and hardware integrations.

## 🛠️ Tech Stack

*   **Framework:** Next.js 14 (App Router)
*   **Server:** Node.js Custom Server + Socket.IO
*   **Database:** PostgreSQL (via Prisma ORM)
*   **Cache & State:** Redis
*   **Mobile:** Capacitor 5 + Native Plugins
*   **Styling:** Tailwind CSS + Lucide Icons

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   PostgreSQL
*   Redis
*   Android Studio (for Mobile Builds)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/songvote.git
    cd songvote
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory and add the following:
    ```env
    # Database
    DATABASE_URL="postgresql://user:password@localhost:5432/songvote?schema=public"
    
    # Redis
    REDIS_URL="redis://localhost:6379"
    
    # Security
    JWT_SECRET="replace_with_a_secure_random_string"
    ENCRYPTION_KEY="12345678901234567890123456789012" # Must be exactly 32 chars
    
    # App
    NEXT_PUBLIC_APP_URL="http://localhost:3000"

    # Super Admin (Optional)
    # The UUID of the user who can access /admin
    SUPER_ADMIN_ID="your-user-uuid-here" 
    ```

4.  **Setup Database**
    ```bash
    npx prisma db push
    ```

5.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to see the app.

## 📱 Mobile Development

SongVote uses Capacitor to wrap the Next.js app in a native Android shell.

1.  **Initialize Android Project**
    ```bash
    npx cap add android
    ```

2.  **Sync Web Assets**
    ```bash
    npm run build
    npx cap sync
    ```

3.  **Run in Emulator**
    ```bash
    npx cap open android
    ```
    *   Click the "Play" button in Android Studio to launch the emulator.
    *   **Note:** Ensure `capacitor.config.ts` has `server.url` set to your dev machine's IP (or `10.0.2.2` for emulator localhost access) for live reloading.

## 📖 How to Use

### For Hosts
1.  **Register/Login:** Create a Host account on the homepage.
2.  **Configure:** Go to **Settings** and enter your **YouTube Data API Key** (Free).
3.  **Start Party:** Create a session. You will see the Host Player.
4.  **Invite:** Click the QR code icon in the header. Guests scan it to join.

### For Super Admins
1.  Register an account normally.
2.  Copy your User ID from the database (or check the `/api/auth/me` endpoint).
3.  Add `SUPER_ADMIN_ID="your_id"` to your `.env` file.
4.  Navigate to `/admin` to view platform analytics.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).