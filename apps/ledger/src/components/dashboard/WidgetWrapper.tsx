import React from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

interface WidgetWrapperProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  /** Sits right after the title, for an info button. */
  titleAdornment?: React.ReactNode;
}

/** Every widget on every page renders through this, so the boundary here is
 *  what keeps one widget's bad data from blanking the whole route. The card
 *  chrome (title and action) stays outside the boundary so a failed widget is
 *  still identifiable. */
export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ title, children, className = '', action, titleAdornment }) => {
  return (
    <div className={`themed-card rounded-lg p-4 flex flex-col h-full min-w-0 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        {titleAdornment ? (
          <div className="flex items-center gap-1 min-w-0">
            <h2 className="text-[18px] font-semibold text-text-primary">{title}</h2>
            {titleAdornment}
          </div>
        ) : (
          <h2 className="text-[18px] font-semibold text-text-primary">{title}</h2>
        )}
        {action && action}
      </div>
      <div className="flex-1">
        <ErrorBoundary variant="widget" label={title}>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  );
};
