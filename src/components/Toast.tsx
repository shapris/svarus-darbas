/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface ToastProps {
  message: string;
  type: 'error' | 'success' | 'info' | 'warning';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertCircle size={20} />;
      case 'success':
        return <CheckCircle size={20} />;
      case 'warning':
        return <AlertTriangle size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'error':
        return 'bg-red-500 text-white border-red-600';
      case 'success':
        return 'bg-green-500 text-white border-green-600';
      case 'warning':
        return 'bg-amber-500 text-white border-amber-600';
      default:
        return 'bg-blue-500 text-white border-blue-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.95 }}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 ${getStyles()}`}
    >
      {getIcon()}
      <span className="text-sm font-medium max-w-md">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 hover:opacity-75 transition-opacity"
        title="Uždaryti"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

// Toast Container Component
interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info' | 'warning';
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}
