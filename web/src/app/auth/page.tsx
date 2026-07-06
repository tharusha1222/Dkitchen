'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Phone, User, KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem('canteen_user_phone')) {
      router.push('/');
    }
  }, [router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('Please enter your name.'); return; }
    if (!phoneNumber.trim()) { setError('Please enter your phone number.'); return; }
    setLoading(true);
    setError('');

    try {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await supabase.from('otps').upsert({
        phone_number: phoneNumber,
        otp_code: generatedOtp,
        expires_at: expiresAt.toISOString(),
      });

      const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:3001';
      const res = await fetch(`${botUrl}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otp: generatedOtp, name: fullName }),
      });
      if (!res.ok) throw new Error('Failed to send WhatsApp message. Is the bot running?');

      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase
        .from('otps')
        .select('*')
        .eq('phone_number', phoneNumber)
        .eq('otp_code', otp)
        .single();

      if (!data) throw new Error('Invalid OTP code. Please try again.');
      if (new Date(data.expires_at) < new Date()) throw new Error('OTP has expired. Please request a new one.');

      await supabase.from('profiles').upsert({
        phone_number: phoneNumber,
        full_name: fullName,
        role: 'student',
      }, { onConflict: 'phone_number' });

      await supabase.from('otps').delete().eq('phone_number', phoneNumber);

      localStorage.setItem('canteen_user_phone', phoneNumber);
      localStorage.setItem('canteen_user_name', fullName);

      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const firstName = fullName ? fullName.split(' ')[0] : '';

  return (
    <div className="min-h-screen bg-[#061208] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#fdf0dc] relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="fixed pointer-events-none inset-0 z-0" aria-hidden="true">
        <div className="absolute top-[-10%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-[#2D6A4F]/20 blur-[90px]" />
        <div className="absolute bottom-[-10%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-[#40916C]/25 blur-[90px]" />
        <div className="absolute top-[30%] left-[50%] w-[35%] h-[35%] rounded-full bg-[#D4A017]/15 blur-[80px]" />
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <img src="/logo.png" alt="DKitchen" className="w-24 h-24 rounded-full object-cover border-2 border-brand-gold/40 shadow-[0_0_30px_rgba(212,160,23,0.25)] mx-auto" />
        <h2 className="mt-6 text-center text-3xl font-bold text-gradient font-serif">
          {step === 'details' ? 'Welcome to DKitchen' : `Hey ${firstName || 'there'}! 👋`}
        </h2>
        <p className="mt-2 text-center text-sm text-white/60 px-4">
          {step === 'details'
            ? 'Enter your details to get started.'
            : `We sent a 6-digit code to ${phoneNumber} on WhatsApp.`}
        </p>
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className={`h-1.5 rounded-full transition-all duration-500 ${step === 'details' ? 'w-8 bg-brand-gold' : 'w-4 bg-brand-gold/40'}`} />
          <div className={`h-1.5 rounded-full transition-all duration-500 ${step === 'otp' ? 'w-8 bg-brand-gold' : 'w-4 bg-white/10'}`} />
        </div>
      </div>

      <div className="mt-8 relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-card py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-gold/15 blur-[70px] rounded-full pointer-events-none" />

          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Step 1: Name + Phone */}
          {step === 'details' && (
            <form onSubmit={handleSendOtp} className="space-y-4 relative z-10">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white/80 mb-2">
                  Your Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-white/40" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Dineth Perera"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="block w-full pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-brand-gold/60 focus:border-transparent transition-all placeholder-white/20 text-[#fdf0dc]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-white/80 mb-2">
                  WhatsApp Number <span className="text-white/40 font-normal">(with country code)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-white/40" />
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    required
                    placeholder="+94771234567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="block w-full pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-brand-gold/60 focus:border-transparent transition-all placeholder-white/20 text-[#fdf0dc]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !fullName.trim() || !phoneNumber.trim()}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-black bg-brand-gold hover:bg-brand-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-[0_0_15px_rgba(212,160,23,0.3)] mt-2"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (<>Send Code <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5 relative z-10">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-white/80 mb-2">
                  Verification Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-white/40" />
                  </div>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    required
                    autoFocus
                    placeholder="123456"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="block w-full pl-10 text-center tracking-[0.5em] font-mono text-xl bg-black/40 border border-white/10 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-brand-gold/60 focus:border-transparent transition-all placeholder-white/20 text-[#fdf0dc]"
                  />
                </div>
                <p className="mt-2 text-xs text-white/40 text-center">Code expires in 10 minutes</p>
              </div>
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-black bg-brand-gold hover:bg-brand-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-[0_0_15px_rgba(212,160,23,0.3)]"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Verify & Login'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('details'); setOtp(''); setError(''); }}
                className="w-full text-sm text-white/50 hover:text-brand-gold transition-colors text-center pt-1"
              >
                ← Change details
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
