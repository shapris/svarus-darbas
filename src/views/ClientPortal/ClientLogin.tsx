/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, ArrowLeft, UserPlus } from 'lucide-react';
import { signIn, type AuthUser } from '../../supabase';
import { motion } from 'motion/react';

interface ClientLoginProps {
    onSuccess: (user: AuthUser) => void;
    onRegister: () => void;
    onBack: () => void;
}

export default function ClientLogin({ onSuccess, onRegister, onBack }: ClientLoginProps) {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const validateForm = () => {
        if (!formData.email.trim()) {
            setError('Privaloma nurodyti el. paštą');
            return false;
        }
        if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            setError('Neteisingas el. pašto formatas');
            return false;
        }
        if (!formData.password.trim()) {
            setError('Privaloma nurodyti slaptažodį');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) return;

        setLoading(true);
        setError('');

        try {
            const result = await signIn(formData.email, formData.password);
            if (result.user) {
                const authUser: AuthUser = {
                    uid: result.user.id,
                    email: result.user.email || '',
                    displayName: result.user.user_metadata?.display_name || result.user.email?.split('@')[0] || null,
                    photoURL: result.user.user_metadata?.avatar_url || null
                };
                onSuccess(authUser);
            } else {
                setError('Nepavyko prisijungti');
            }
        } catch (err: any) {
            setError(err.message || 'Prisijungimo klaida');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">Kliento Prisijungimas</h1>
                    <p className="text-gray-600 mt-2">Prisijunkite norėdami matyti savo užsakymus</p>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6"
                    >
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            El. paštas
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="email@example.com"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Slaptažodis
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Įveskite slaptažodį"
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-600">Prisiminti mane</span>
                        </label>
                        <button
                            type="button"
                            className="text-sm text-blue-600 hover:text-blue-800"
                        >
                            Pamiršote slaptažodį?
                        </button>
                    </div>

                    <div className="space-y-3 pt-4">
                        <button
                            type="submit"
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? 'Prisijungiama...' : 'Prisijungti'}
                        </button>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onBack}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
                                disabled={loading}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Atgal</span>
                            </button>
                            <button
                                type="button"
                                onClick={onRegister}
                                className="flex-1 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2"
                                disabled={loading}
                            >
                                <UserPlus className="w-4 h-4" />
                                <span>Registruotis</span>
                            </button>
                        </div>
                    </div>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                        Dar neturite paskyros?{' '}
                        <button
                            type="button"
                            onClick={onRegister}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Registruokites čia
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
