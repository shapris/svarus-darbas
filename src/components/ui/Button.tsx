/**
 * Bendri mygtukai — vienodos būsenos, fokusas, šešėliai.
 */
import React from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'successSoft'
  | 'outline'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.99] active:bg-blue-800 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100',
  secondary:
    'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50',
  success:
    'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.99] active:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none',
  successSoft:
    'bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100 active:bg-emerald-200/80 disabled:opacity-50',
  outline:
    'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50',
  ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-xs font-semibold rounded-lg min-h-9',
  md: 'px-4 py-2.5 text-sm font-medium rounded-xl min-h-[2.75rem]',
  lg: 'px-5 py-3.5 text-base font-semibold rounded-xl min-h-12',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, className = '', type = 'button', ...props },
  ref
) {
  const base =
    'inline-flex items-center justify-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
  const width = fullWidth ? 'w-full' : '';
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${width} ${className}`.trim()}
      {...props}
    />
  );
});
