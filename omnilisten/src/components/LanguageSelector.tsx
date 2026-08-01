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
        <div className="flex items-center gap-2">
            <label htmlFor="language-select" className="text-xs font-medium text-zinc-400 dark:text-zinc-400">
                🎙️ Language:
            </label>
            <select
                id="language-select"
                value={selectedLanguage}
                onChange={handleLanguageChange}
                disabled={isPending}
                className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer disabled:opacity-50"
            >
                {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                        {lang.label}
                    </option>
                ))}
            </select>
            {isPending && <span className="text-[10px] text-amber-500 animate-pulse font-mono">Translating Audio...</span>}
        </div>
    );
}
