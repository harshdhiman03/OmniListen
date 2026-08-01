"use client";

import { useState, useTransition } from 'react';
import { updateUserLanguagePreference, translateAndSynthesizePlaylist } from '@/app/dashboard/actions';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', label: 'English' },
    { code: 'hi', name: 'Hindi', label: 'हिन्दी (Hindi)' },
    { code: 'ta', name: 'Tamil', label: 'தமிழ் (Tamil)' },
    { code: 'te', name: 'Telugu', label: 'తెలుగు (Telugu)' },
    { code: 'bn', name: 'Bengali', label: 'বাংলা (Bengali)' },
    { code: 'mr', name: 'Marathi', label: 'मराठी (Marathi)' },
    { code: 'gu', name: 'Gujarati', label: 'ગુજરાતી (Gujarati)' },
    { code: 'kn', name: 'Kannada', label: 'ಕನ್ನಡ (Kannada)' },
    { code: 'ml', name: 'Malayalam', label: 'മലയാളം (Malayalam)' },
    { code: 'pa', name: 'Punjabi', label: 'ਪੰਜਾਬੀ (Punjabi)' },
];

interface LanguageSelectorProps {
    currentLanguage?: string;
    activePlaylistId?: string;
}

export default function LanguageSelector({ currentLanguage = 'en', activePlaylistId }: LanguageSelectorProps) {
    const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
    const [isPending, startTransition] = useTransition();

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value;
        setSelectedLanguage(newLang);

        startTransition(async () => {
            // 1. Save user's preference in profiles
            await updateUserLanguagePreference(newLang);

            // 2. If a playlist is active, synthesize/fetch target language MP3s on-demand
            if (activePlaylistId) {
                console.log(`[Language Switch] Requesting lazy synthesis for playlist ${activePlaylistId} in [${newLang}]`);
                await translateAndSynthesizePlaylist(activePlaylistId, newLang);
            }

            // 3. Reload browser window so HTML5 Audio elements immediately re-bind to the new translated MP3 URLs
            window.location.reload();
        });
    };

    return (
        <div className="flex items-center gap-2 relative">
            <div className="relative flex items-center">
                <select
                    id="language-select"
                    value={selectedLanguage}
                    onChange={handleLanguageChange}
                    disabled={isPending}
                    className="appearance-none bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md border border-white/10 hover:border-cyan-500/30 text-white text-xs font-semibold rounded-full pl-3.5 pr-8 py-2 shadow-lg shadow-black/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all duration-300 cursor-pointer disabled:opacity-50"
                    aria-label="Select audio language"
                >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code} className="bg-gray-900 text-white">
                            {lang.label}
                        </option>
                    ))}
                </select>
                {/* Sleek Chevron Down Icon */}
                <div className="absolute right-3 pointer-events-none text-zinc-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
            {isPending && <span className="text-[10px] text-cyan-400 animate-pulse font-mono tracking-wider">Translating...</span>}
        </div>
    );
}
