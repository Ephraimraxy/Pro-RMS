import React, { useState } from 'react';

const PublicVerify = () => {
  const params = new URLSearchParams(window.location.search);
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const codeFromPath = pathParts[0] === 'verify' && pathParts[1] ? pathParts[1] : '';
  const initialCode = params.get('code') || codeFromPath || '';
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!code) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const resp = await fetch(`/api/public-verify/${encodeURIComponent(code)}`);
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Verification failed');
      }
      const data = await resp.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-6">
      <div className="bg-white/80 border border-border/50 rounded-3xl shadow-xl w-full max-w-lg p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Public Verification</h1>
          <p className="text-sm text-muted-foreground mt-1">Verify a requisition using the printed code.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Verification Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="VER-XXXXXX"
            className="w-full bg-muted/30 border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none text-sm font-mono"
          />
        </div>

        <button
          onClick={handleVerify}
          disabled={!code || loading}
          className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2 text-sm">
            <p><span className="font-bold">Code:</span> {result.verificationCode}</p>
            <p><span className="font-bold">Signature:</span> {result.signatureValid ? 'VALID' : 'INVALID'}</p>
            <p><span className="font-bold">PDF Integrity:</span> {result.pdfValid === null ? 'N/A' : (result.pdfValid ? 'VALID' : 'INVALID')}</p>
            <p><span className="font-bold">Requisition ID:</span> {result.requisitionId || '—'}</p>
            <p><span className="font-bold">Approved At:</span> {result.approvedAt ? new Date(result.approvedAt).toLocaleString() : '—'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicVerify;
