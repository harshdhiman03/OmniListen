import ChatOnboarding from '@/components/ChatOnboarding';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
    // Fetch Authenticated User Session (Mocked flawlessly for the MVP)
    const { data: profileData } = await supabaseServer
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
        
    const userId = profileData?.id;

    return (
        <div className="min-h-screen bg-gray-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black text-white selection:bg-cyan-500/30">
            {/* Lightweight Header for context */}
            <header className="absolute top-0 w-full p-6 border-b border-white/5 bg-gray-950/50 backdrop-blur-md z-50">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </div>
                    <span className="text-lg font-bold">Omni<span className="text-cyan-400">Listen</span> Initialization</span>
                </div>
            </header>

            {/* Mount the previously built Client Component */}
            <main className="pt-24 h-screen max-w-4xl mx-auto flex flex-col">
                <ChatOnboarding userId={userId} />
            </main>
        </div>
    );
}
