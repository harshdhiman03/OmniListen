import { login, signup } from './actions'

export default async function LoginPage(props: { searchParams: Promise<{ message?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black flex flex-col items-center justify-center p-6 text-white font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      
      <div className="z-10 w-full max-w-md p-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.2)] mb-4">
                <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">OmniListen Edge</h1>
            <p className="text-gray-400 text-sm mt-1">Authenticate your agentic neural link.</p>
        </div>

        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400 font-medium" htmlFor="email">Encrypted Node (Email)</label>
            <input 
                id="email" 
                name="email" 
                type="email" 
                required 
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                placeholder="agent@omnidynamics.ai"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400 font-medium" htmlFor="password">Security Protocol (Password)</label>
            <input 
                id="password" 
                name="password" 
                type="password" 
                required 
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                placeholder="••••••••••••"
            />
          </div>

          {searchParams?.message && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
                {searchParams.message}
            </div>
          )}

          <div className="flex gap-4 mt-4">
            <button 
                formAction={login} 
                className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl py-3 font-medium transition-all"
            >
              Initialize Link
            </button>
            <button 
                formAction={signup} 
                className="flex-1 bg-gradient-to-r hover:bg-gradient-to-bl from-cyan-500 to-blue-600 shadow-[0_0_20px_rgba(6,182,212,0.3)] text-white rounded-xl py-3 font-semibold transition-all hover:scale-[1.02]"
            >
              New Agent
            </button>
          </div>
        </form>
      </div>

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse" />
    </div>
  )
}
