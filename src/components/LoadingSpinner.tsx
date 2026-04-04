/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export default function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Loader2 className={`animate-spin ${sizeClasses[size]} text-blue-600`} />
      {text && <span className="text-sm text-slate-600">{text}</span>}
    </div>
  );
}

export function FullPageLoader({ text = 'Kraunama...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-slate-600 font-medium">{text}</p>
      </div>
    </div>
  );
}

export function ButtonLoader({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin text-white" />
      <span>{text}</span>
    </div>
  );
}
