export default function HostProfilePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Profile Settings</h1>
      
      <div className="grid gap-8">
        
        {/* Account Info Card */}
        <div className="card p-8">
            <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-[var(--border)]">Account Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium mb-2 opacity-70">Username</label>
                    <input disabled type="text" value="dj_mike" className="w-full p-2.5 rounded-lg border border-[var(--border)] bg-[var(--foreground)]/5 opacity-50" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 opacity-70">Email (Optional)</label>
                    <input type="email" placeholder="Add your email" className="w-full p-2.5 rounded-lg border border-[var(--border)] bg-transparent" />
                </div>
            </div>
        </div>

        {/* Branding Card */}
        <div className="card p-8">
            <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-[var(--border)]">Channel Branding</h2>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-[var(--foreground)]/10 flex items-center justify-center border-2 border-dashed border-[var(--foreground)]/30">
                        <span className="text-xs opacity-50">Upload</span>
                    </div>
                    <div>
                        <h3 className="font-medium">Profile Picture</h3>
                        <p className="text-sm opacity-60">Recommended 400x400px</p>
                    </div>
                    <button className="ml-auto px-4 py-2 text-sm font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--foreground)]/5">
                        Change
                    </button>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}