/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info' | 'warning';
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'error' | 'success' | 'info' | 'warning' = 'info', duration?: number) => {
    const id = Date.now().toString() + Math.random().toString(36);
    const toast: Toast = { id, message, type, duration };
    setToasts(prev => [...prev, toast]);
    
    // Auto-dismiss after duration (default 5s)
    const dismissAfter = duration || (type === 'error' ? 8000 : 5000);
    setTimeout(() => {
      removeToast(id);
    }, dismissAfter);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showToast = {
    success: (message: string, duration?: number) => addToast(message, 'success', duration),
    error: (message: string, duration?: number) => addToast(message, 'error', duration),
    warning: (message: string, duration?: number) => addToast(message, 'warning', duration),
    info: (message: string, duration?: number) => addToast(message, 'info', duration),
  };

  return {
    toasts,
    addToast,
    removeToast,
    showToast,
  };
}
