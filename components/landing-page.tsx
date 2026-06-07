'use client';

import React from 'react';
import { useAuth } from './firebase-provider';
import Image from 'next/image';
import { ShieldAlert, LogIn, CheckCircle, FileText } from 'lucide-react';

export default function LandingPage() {
  const { login, error, loading } = useAuth();

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#092E20] via-[#0F5132] to-[#041d14] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(34,197,94,0.15),rgba(0,0,0,0))]" />

      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/20 transition-all duration-350 hover:shadow-green-900/30">
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-[#092E20] to-[#0F5132] p-8 text-center text-white relative">
          <div className="mx-auto w-24 h-24 bg-white p-2 rounded-full shadow-lg border-2 border-[#22C55E] flex items-center justify-center overflow-hidden mb-4 relative">
            <Image
              src="/logo.png"
              alt="Vaishnavi Enterprise Logo"
              width={80}
              height={80}
              id="applet-landing-logo"
              className="object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight uppercase">Vaishnavi Enterprise</h1>
          <p className="text-sm text-green-200 mt-1 uppercase tracking-wider font-semibold">Self-Adhesive Label Manufacturer</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#22C55E]" />
        </div>

        {/* Content body */}
        <div className="p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Sales CRM & Quotation PWA</h2>
            <p className="text-sm text-gray-500 mt-2">
              Welcome to the central workforce portal. Please sign in with your corporate Google Account to manage leads, follow-ups, and generate client quotations.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700 flex items-start gap-3 animated text-xs leading-relaxed">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-bold">Access Unauthorized</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-xs text-gray-600 space-y-2">
              <div className="flex items-center gap-2 font-medium text-[#092E20]">
                <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                <span>Authorized Account Access Only</span>
              </div>
              <p>
                Strict authorization active. This CRM is exclusively provisioned for{' '}
                <strong className="text-[#0F5132]">vaishnavienterprise.print@gmail.com</strong>.
              </p>
            </div>

            <button
              onClick={login}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-[#092E20] hover:bg-[#0F5132] text-white active:bg-black font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 select-none cursor-pointer text-sm"
              id="btn-google-sign-in"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5 text-[#22C55E]" />
                  <span>Sign in with Google</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-gray-50 border-t border-gray-100 px-8 py-4 flex justify-between items-center text-[10px] text-gray-400 font-mono">
          <span>PORTAL VER: 2.1.0</span>
          <span>© 2026 VAISHNAVI ENTERPRISE</span>
        </div>
      </div>
    </main>
  );
}
