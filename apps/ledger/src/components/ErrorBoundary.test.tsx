import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

const Boom: React.FC = () => {
  throw new Error('page exploded');
};

let shouldThrow = true;

const ConditionalBoom: React.FC = () => {
  if (shouldThrow) {
    throw new Error('conditional boom');
  }
  return <span>recovered</span>;
};

describe('ErrorBoundary - page variant', () => {
  it('shows full-page fallback when child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
        <span>page content</span>
      </div>,
    );

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('clears error state on Try again, allowing child to render if it no longer throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ConditionalBoom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();

    shouldThrow = false;
    const tryAgainButton = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(tryAgainButton);

    expect(screen.getByText('recovered')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument();

    spy.mockRestore();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <span>fine content</span>
      </ErrorBoundary>,
    );

    expect(screen.getByText('fine content')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument();
  });
});
