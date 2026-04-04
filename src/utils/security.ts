/**
 * Security and Validation Utilities
 * Production-ready input validation and sanitization
 */

import DOMPurify from 'dompurify';

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone validation (Lithuanian format)
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^(\+370|8)\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Password strength validation
export const validatePassword = (
  password: string
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Slaptažodis turi būti bent 8 simbolių ilgio');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Slaptažodyje turi būti bent viena didžioji raidė');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Slaptažodyje turi būti bent viena mažoji raidė');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Slaptažodyje turi būti bent vienas skaičius');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Sanitize user input
export const sanitizeInput = (input: string): string => {
  if (typeof window !== 'undefined') {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  }
  // Server-side fallback
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

// Validate and sanitize form data
export const validateFormData = (
  data: Record<string, any>
): {
  isValid: boolean;
  sanitized: Record<string, any>;
  errors: Record<string, string>;
} => {
  const sanitized: Record<string, any> = {};
  const errors: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      const clean = sanitizeInput(value.trim());
      sanitized[key] = clean;

      if (clean.length === 0 && value.length > 0) {
        errors[key] = 'Netinkamas įvesties formatas';
      }
    } else {
      sanitized[key] = value;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    sanitized,
    errors,
  };
};

// Rate limiting helper
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 5, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  canProceed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const validAttempts = attempts.filter((time) => now - time < this.windowMs);

    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }

    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }

  getRemainingTime(key: string): number {
    const attempts = this.attempts.get(key) || [];
    if (attempts.length === 0) return 0;

    const oldestAttempt = Math.min(...attempts);
    const remaining = this.windowMs - (Date.now() - oldestAttempt);
    return Math.max(0, remaining);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Auth rate limiters
export const loginRateLimiter = new RateLimiter(5, 300000); // 5 attempts per 5 minutes
export const registerRateLimiter = new RateLimiter(3, 3600000); // 3 attempts per hour

// CSRF Token generator
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

// Secure storage helpers
export const secureStorage = {
  set: (key: string, value: string): void => {
    try {
      // Encrypt or encode sensitive data
      const encoded = btoa(value);
      localStorage.setItem(key, encoded);
    } catch {
      // Fallback to regular storage
      localStorage.setItem(key, value);
    }
  },

  get: (key: string): string | null => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;

      // Try to decode
      try {
        return atob(value);
      } catch {
        return value;
      }
    } catch {
      return null;
    }
  },

  remove: (key: string): void => {
    localStorage.removeItem(key);
  },
};

// Security headers for fetch requests
export const secureHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'X-CSRF-Token': secureStorage.get('csrf_token') || '',
});

// Input validation helpers
export const validators = {
  required: (value: any): boolean => {
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== null && value !== undefined;
  },

  minLength: (value: string, min: number): boolean => value.length >= min,

  maxLength: (value: string, max: number): boolean => value.length <= max,

  numeric: (value: string): boolean => /^\d+$/.test(value),

  date: (value: string): boolean => !isNaN(Date.parse(value)),

  price: (value: number): boolean => value >= 0 && !isNaN(value),
};

// Audit logging
export const auditLog = (action: string, details: Record<string, any>): void => {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    details: sanitizeInput(JSON.stringify(details)),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  // Send to analytics or monitoring service
  console.log('[AUDIT]', entry);

  // Could also send to backend
  // fetch('/api/audit', { method: 'POST', body: JSON.stringify(entry) });
};

// Error sanitization for UI display
export const sanitizeError = (error: any): string => {
  if (typeof error === 'string') {
    return sanitizeInput(error).substring(0, 200);
  }
  if (error?.message) {
    return sanitizeInput(error.message).substring(0, 200);
  }
  return 'Įvyko klaida';
};
