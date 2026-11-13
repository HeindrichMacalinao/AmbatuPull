'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, KeyRound, ArrowLeft, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      if (data.notRegistered) {
        setError(data.emailError || `No registered account found with email "${email.trim()}".`);
        return;
      }

      setSubmitted(true);
      if (data.debugToken) {
        setDebugToken(data.debugToken);
      }
      if (data.pendingToken) {
        setPendingToken(data.pendingToken);
      }
      if (data.emailSent === false && data.emailError) {
        setError(`Email delivery notice: ${data.emailError}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request password recovery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-8 py-7 text-white text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mx-auto mb-3 shadow-md">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Forgot Password</h1>
          <p className="text-xs text-slate-300 mt-1">
            Generate an authenticated 6-digit password recovery code
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {submitted ? (
            <div className="text-center space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                <p className="font-bold text-sm">Recovery Request Processed</p>
                <p className="mt-1 text-slate-600">
                  If <strong>{email}</strong> is registered, a 6-digit recovery code and reset link have been sent to your inbox.
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  The code is valid for 15 minutes. Check your spam/junk folder if needed.
                </p>
              </div>

              {debugToken && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-left text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Vercel Testing Helper:</span>
                  </div>
                  <div className="font-mono text-xs font-bold text-blue-700 bg-white p-2 border border-amber-200 rounded select-all">
                    Reset Code / Token: {debugToken}
                  </div>
                  <div className="text-[10px] text-amber-700 mt-1">
                    (In production with SMTP or Resend configured, this code is emailed directly to your inbox).
                  </div>
                </div>
              )}

              <Link
                href={`/reset-password?email=${encodeURIComponent(email)}${
                  debugToken ? `&token=${encodeURIComponent(debugToken)}` : ''
                }${pendingToken ? `&pendingToken=${encodeURIComponent(pendingToken)}` : ''}`}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition"
              >
                <span>Proceed to Enter Code & Reset Password</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="text-xs text-slate-500 hover:text-slate-800 transition inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Enter your registered work email to receive a 6-digit verification code.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {loading ? <span>Sending Code...</span> : <span>Send Recovery Code</span>}
              </button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="text-xs text-slate-500 hover:text-slate-800 transition inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
