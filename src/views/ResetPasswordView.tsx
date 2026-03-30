/**
 * Šis puslapis atidaromas iš el. laiško nuorodos (Supabase atkūrimas arba Firebase reset).
 */

import React, { useState, useMemo } from 'react';
import { Droplets, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase, usesFirebase, isDemoMode } from '../supabase';
import * as FirebaseBackend from '../firebaseBridge';
import { formatAuthErrorForUser } from '../utils/authMessages';

export default function ResetPasswordView() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const [busy, setBusy] = useState(false);

    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const oobCode = params.get('oobCode');
    const mode = params.get('mode');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password.length < 6) {
            setError('Slaptažodis turi būti bent 6 simbolių.');
            return;
        }
        if (password !== confirm) {
            setError('Slaptažodžiai nesutampa.');
            return;
        }
        if (isDemoMode || (!usesFirebase && !supabase)) {
            setError('Slaptažodžio keitimas nepasiekiamas vietiniame režime.');
            return;
        }

        setBusy(true);
        try {
            if (usesFirebase) {
                if (mode !== 'resetPassword' || !oobCode) {
                    setError('Trūksta atkūrimo nuorodos. Atidarykite puslapį iš el. laiško.');
                    setBusy(false);
                    return;
                }
                await FirebaseBackend.confirmFirebasePasswordReset(oobCode, password);
            } else if (supabase) {
                let {
                    data: { session },
                } = await supabase.auth.getSession();
                if (!session) {
                    await new Promise((r) => setTimeout(r, 500));
                    ({ data: { session } } = await supabase.auth.getSession());
                }
                if (!session) {
                    setError('Nuoroda negalioja arba pasibaigė. Paprašykite naujo atkūrimo laiško.');
                    setBusy(false);
                    return;
                }
                const { error: upErr } = await supabase.auth.updateUser({ password });
                if (upErr) throw upErr;
                await supabase.auth.signOut();
            }
            setDone(true);
            window.setTimeout(() => {
                window.location.replace('/');
            }, 1200);
        } catch (err: unknown) {
            setError(formatAuthErrorForUser(err, 'Nepavyko pakeisti slaptažodžio.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-2xl shadow-md max-w-sm w-full border border-slate-200"
            >
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-white">
                    <Droplets size={24} strokeWidth={2} />
                </div>
                <h1 className="text-xl font-semibold text-slate-900 text-center mb-1">Naujas slaptažodis</h1>
                <p className="text-slate-600 text-sm text-center mb-6">
                    Įveskite naują slaptažodį paskyrai „{usesFirebase ? 'Firebase' : 'Supabase'}“.
                </p>

                {done ? (
                    <p className="text-center text-emerald-700 text-sm font-medium">Slaptažodis atnaujintas. Nukreipiama…</p>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
                        )}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Naujas slaptažodis</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm"
                                    disabled={busy}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Pakartokite slaptažodį</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm"
                                    disabled={busy}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={busy}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {busy ? 'Saugoma…' : 'Išsaugoti slaptažodį'}
                        </button>
                        <button
                            type="button"
                            onClick={() => window.location.replace('/')}
                            className="w-full text-slate-500 text-sm hover:text-slate-700"
                        >
                            Atgal į prisijungimą
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
