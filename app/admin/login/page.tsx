'use client';

import { useState } from 'react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError('รหัสผ่านไม่ถูกต้อง');
      return;
    }
    const next = new URLSearchParams(window.location.search).get('next') || '/admin';
    window.location.href = next;
  };

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-zinc-900/70 backdrop-blur p-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Admin Login</h1>
        <input
          type="password"
          className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 outline-none"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={loading} className="w-full h-11 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 active:scale-[0.99]">
          {loading ? 'กำลังเข้าระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
