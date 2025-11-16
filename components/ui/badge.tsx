import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200',
  {
    variants: {
      variant: {
        default:
          'bg-primary-100 text-primary-700 border-primary-200',
        outline: 'text-brown-700 border-brown-300',
        destructive:
          'bg-red-100 text-red-700 border-red-200',
        success:
          'bg-green-100 text-green-700 border-green-200',
        warning:
          'bg-amber-100 text-amber-700 border-amber-200',
        secondary:
          'bg-secondary-100 text-secondary-700 border-secondary-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={badgeVariants({ variant })} {...props} />
  );
}

export { Badge, badgeVariants };
