import Link from 'next/link';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-gray-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black text-white font-sans selection:bg-cyan-500/30 overflow-hidden relative">
            
            {/* Immersive Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-cyan-900/10 blur-[150px] rounded-full pointer-events-none" />

            {/* Navigation Bar */}
            <nav className="relative z-10 flex items-center justify-between px-8 py-6 w-full max-w-7xl mx-auto border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </div>
                    <span className="text-xl font-bold tracking-tight">Omni<span className="text-cyan-400">Listen</span></span>
                </div>
                <div>
                    <Link href="/dashboard" className="text-gray-400 hover:text-white font-semibold transition-colors duration-200">
                        Login
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-32 pb-24 max-w-4xl mx-auto min-h-[80vh]">
                
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <span className="flex w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span className="text-sm font-medium tracking-wide text-gray-300">Infinite Personalized News</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
                    Your World. Your Narrator. <br className="hidden md:block"/>
                    <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">Every Single Morning.</span>
                </h1>

                <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-2xl font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
                    OmniListen's AI learns your precise interests and autonomously generates a studio-grade, personalized news radio briefing while you sleep.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-6 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
                    <Link 
                        href="/onboarding" 
                        className="px-8 py-4 w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full font-bold shadow-[0_0_30px_rgba(6,182,212,0.3)] text-white text-lg tracking-wide transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] hover:from-cyan-400 hover:to-blue-500 text-center flex items-center justify-center gap-3"
                    >
                        Start Your Onboarding
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </Link>
                    
                    <Link 
                        href="/dashboard"
                        className="px-8 py-4 w-full sm:w-auto bg-white/5 border border-white/10 rounded-full font-bold text-gray-300 text-lg hover:bg-white/10 transition-colors duration-300 text-center"
                    >
                        Skip to Dashboard
                    </Link>
                </div>

            </main>
        </div>
    );
}
