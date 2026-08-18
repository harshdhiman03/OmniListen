"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
}

export default function ChatOnboarding({ userId }: { userId?: string }) {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init-1',
            role: 'ai',
            content: "Welcome! To build your personalized news radio, what industries, topics, or hobbies do you actively follow?"
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Track user engagement to conditionally render the "Finish Setup" CTA
    const userMessageCount = messages.filter(m => m.role === 'user').length;

    // Smooth auto-scroll behavior for incoming AI messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userText = inputValue.trim();
        const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: userText };
        
        setMessages(prev => [...prev, newUserMsg]);
        setInputValue("");
        setIsLoading(true);

        try {
            // Forward interaction to Edge Runtime for Gemini conversational processing
            const response = await fetch('/api/onboarding/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, message: userText, history: messages.concat(newUserMsg) })
            });

            if (!response.ok) throw new Error('Failed to reach AI onboarding endpoint');

            const data = await response.json();
            
            // Append incoming conversational AI reply to the thread
            setMessages(prev => [...prev, { 
                id: (Date.now() + 1).toString(), 
                role: 'ai', 
                content: data.reply || "Fascinating! Any other specific topics?" 
            }]);
        } catch (error) {
            console.error("Chat orchestration error:", error);
            // Fallback UI response to ensure the flow remains entirely robust during development cycles
            setMessages(prev => [...prev, { 
                id: (Date.now() + 1).toString(), 
                role: 'ai', 
                content: "I've logged that. What else excites you?" 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinishSetup = async () => {
        setIsLoading(true);
        try {
            // Signal the backend to synthesize the entire conversational history into a single 
            // highly targeted 768-dimensional semantic 'interest_vector' and inject it into the Supabase database.
            await fetch('/api/onboarding/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, history: messages }) 
            });
            
            // Push user to their newly crafted personalized experience!
            router.push('/dashboard');
        } catch (error) {
            console.error("Failed to commit final onboarding vector:", error);
            // If API isn't deployed yet, fallback gracefully to the dashboard anyway
            router.push('/dashboard');
        }
    };

    return (
        <div className="flex flex-col w-full max-w-2xl mx-auto h-[650px] bg-gray-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden transition-all duration-500">
            {/* Minimalist Glassmorphic Dashboard Header */}
            <div className="flex items-center justify-between px-6 py-5 bg-white/5 border-b border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold bg-gradient-to-r from-cyan-100 to-white bg-clip-text text-transparent">OmniListen Setup</h2>
                        <p className="text-sm text-cyan-400/80 font-medium tracking-wide">Personalizing your radio brain...</p>
                    </div>
                </div>
                
                {/* Dynamically un-hide the Finish button after at least 2 distinct user inputs */}
                {userMessageCount >= 2 && (
                    <button 
                        onClick={handleFinishSetup}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl backdrop-blur-sm flex items-center group placeholder-opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                        Finish Setup 
                        <svg className="w-4 h-4 inline-block ml-2 -mt-0.5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </button>
                )}
            </div>

            {/* AI Communication Viewport */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth custom-scrollbar">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div 
                            className={`max-w-[85%] px-5 py-3.5 rounded-3xl text-[15px] leading-relaxed shadow-md backdrop-blur-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
                                msg.role === 'user' 
                                    ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white rounded-br-md shadow-cyan-500/20 font-medium' 
                                    : 'bg-white/10 text-gray-100 border border-white/5 rounded-bl-md shadow-black/20'
                            }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                
                {/* Visual Feedback for AI Processing */}
                {isLoading && (
                    <div className="flex w-full justify-start animate-in fade-in duration-300">
                        <div className="bg-white/5 border border-white/5 px-5 py-4 rounded-3xl rounded-bl-md flex items-center gap-2 backdrop-blur-sm shadow-xl">
                            <div className="w-2.5 h-2.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2.5 h-2.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2.5 h-2.5 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                {/* Interactive Guidance Toast when enough interests have been gathered */}
                {userMessageCount >= 2 && (
                    <div className="mx-2 p-4 bg-gradient-to-r from-cyan-950/80 via-blue-950/80 to-slate-900/90 border border-cyan-500/30 rounded-2xl backdrop-blur-xl shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0">
                                <span className="text-lg">✨</span>
                            </div>
                            <div className="text-left">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Ready Whenever You Are</h4>
                                <p className="text-xs text-gray-300">You can finalize your setup now to build your first audiobook, or keep explaining for deeper personalization!</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                            <button
                                type="button"
                                onClick={handleFinishSetup}
                                disabled={isLoading}
                                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl transition-all duration-300 shadow-md hover:shadow-cyan-500/30 active:scale-95 disabled:opacity-50"
                            >
                                Finish Setup Now →
                            </button>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* OmniListen Interactive Input Form */}
            <div className="p-5 bg-black/30 border-t border-white/5">
                <form onSubmit={handleSendMessage} className="relative flex items-center group">
                    <input 
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type an interest, e.g. 'Space Exploration' or 'Nvidia APIs'..."
                        disabled={isLoading}
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-400/60 px-5 py-4 pl-6 pr-16 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:bg-white/10 transition-all duration-300 disabled:opacity-50 tracking-wide"
                    />
                    <button 
                        type="submit"
                        disabled={!inputValue.trim() || isLoading}
                        className="absolute right-2 p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white disabled:opacity-30 disabled:from-gray-600 disabled:to-gray-600 hover:from-cyan-400 hover:to-blue-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                        <svg className="w-5 h-5 -rotate-45 ml-0.5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </form>
            </div>

            {/* Custom Browser Scrollbar Styling Injection */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}</style>
        </div>
    );
}
