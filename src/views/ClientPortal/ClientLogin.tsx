/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, ArrowLeft, UserPlus } from 'lucide-react';
import { signIn, requestPasswordResetEmail, type AuthUser } from '../../supabase';
import { formatAuthErrorForUser, AUTH_FALLBACK } from '../../utils/authMessages';
import { motion } from 'motion/react';

interface ClientLoginProps {
  onSuccess: (user: AuthUser) => void;
  onRegister: () => void;
  onBack: () => void;
  allowRegistration?: boolean;
}

export default function ClientLogin({
  onSuccess,
  onRegister,
  onBack,
  allowRegistration = false,
}: ClientLoginProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setNotice('');
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
          displayName:
            result.user.user_metadata?.display_name || result.user.email?.split('@')[0] || null,
          photoURL: result.user.user_metadata?.avatar_url || null,
        };
        onSuccess(authUser);
      } else {
        setError('Nepavyko prisijungti');
      }
    } catch (err: unknown) {
      setError(formatAuthErrorForUser(err, AUTH_FALLBACK.login));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setNotice('');

    const email = formData.email.trim();
    if (!email) {
      setError('Įveskite el. paštą, kad galėtume išsiųsti slaptažodžio atstatymo nuorodą.');
      return;
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Neteisingas el. pašto formatas');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordResetEmail(email);
      setNotice('Jei paskyra egzistuoja, netrukus gausite laišką su nuoroda.');
    } catch (err: unknown) {
      setError(formatAuthErrorForUser(err, 'Nepavyko išsiųsti slaptažodžio atstatymo laiško.'));
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
          <h1 className="text-2xl font-bold text-gray-800">Kliento prisijungimas</h1>
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
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6"
          >
            {notice}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">El. paštas</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Slaptažodis</label>
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
              onClick={handleForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-800"
              disabled={loading}
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
              {allowRegistration && (
                <button
                  type="button"
                  onClick={onRegister}
                  className="flex-1 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2"
                  disabled={loading}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Registruotis</span>
                </button>
              )}
            </div>
          </div>
        </form>

        {allowRegistration ? (
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
        ) : (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Neturite kliento portalo paskyros? Rezervuoti galite be paskyros per jums atsiųstą
            rezervacijos nuorodą, o prisijungimą portale aktyvuoja administratorius.
          </div>
        )}
      </motion.div>
    </div>
  );
}
