'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import LogoLoader from '@/components/LogoLoader';
import { login, signup } from './actions';

interface LoginFormProps {
  message?: string;
}

export default function LoginForm({ message }: LoginFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [pendingText, setPendingText] = useState("Authenticating Neural Link...");

  const handleSubmit = (action: (formData: FormData) => Promise<void>, loadingMsg: string) => {
    return async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsPending(true);
      setPendingText(loadingMsg);

      const form = e.currentTarget;
      const formData = new FormData(form);

      try {
        await action(formData);
      } catch (err) {
        setIsPending(false);
      }
    };
  };

  return (
    <>
      {isPending && <LogoLoader message={pendingText} fullScreen={true} />}

      <div className="z-10 w-full max-w-md p-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col items-center mb-8">
          {/* Glowing Liquid Glass Brand Orb Container with omnilogo.png */}
          <div className="relative group cursor-pointer mb-4">
            <div className="w-20 h-20 rounded-[36px] bg-black/70 flex items-center justify-center border-2 border-cyan-500/50 p-1 shadow-[0_0_25px_rgba(6,182,212,0.5)] ring-1 ring-white/10 transition-all duration-300 transform-gpu group-hover:scale-105 group-hover:shadow-[0_0_40px_rgba(6,182,212,0.75)] overflow-hidden">
              <Image 
                src="/omnilogo.png" 
                alt="OmniListen Logo" 
                width={72} 
                height={72} 
                className="w-full h-full object-contain rounded-full drop-shadow-[0_0_20px_rgba(6,182,212,0.95)] drop-shadow-[0_0_35px_rgba(6,182,212,0.7)] shrink-0"
                priority
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">OmniListen Edge</h1>
          <p className="text-gray-400 text-sm mt-1">Authenticate your agentic neural link.</p>
        </div>

        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400 font-medium" htmlFor="first_name">Agent Name (First Name)</label>
            <input 
              id="first_name" 
              name="first_name" 
              type="text" 
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              placeholder="Alex"
            />
          </div>

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

          {message && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
              {message}
            </div>
          )}

          <div className="flex gap-4 mt-4">
            <button 
              formAction={async (formData) => {
                setIsPending(true);
                setPendingText("Authenticating Neural Link...");
                await login(formData);
              }}
              className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl py-3 font-medium transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              Initialize Link
            </button>
            <button 
              formAction={async (formData) => {
                setIsPending(true);
                setPendingText("Provisioning New Agent Node...");
                await signup(formData);
              }} 
              className="flex-1 bg-gradient-to-r hover:bg-gradient-to-bl from-cyan-500 to-blue-600 shadow-[0_0_20px_rgba(6,182,212,0.3)] text-white rounded-xl py-3 font-semibold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              New Agent
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
