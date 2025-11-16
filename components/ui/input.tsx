/**
 * Input Component
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-lg border-2 border-brown-200 bg-white px-4 py-2.5 text-sm text-brown-900',
          'placeholder:text-brown-400',
          'focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-brown-50',
          'transition-all duration-200',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
