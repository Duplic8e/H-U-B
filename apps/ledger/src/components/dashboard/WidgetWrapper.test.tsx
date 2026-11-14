import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WidgetWrapper } from './WidgetWrapper';

describe('WidgetWrapper', () => {
  it('renders title and children correctly', () => {
    render(
      <WidgetWrapper title="Test Widget">
        <p>Widget Content</p>
      </WidgetWrapper>
    );
    
    expect(screen.getByText('Test Widget')).toBeDefined();
    expect(screen.getByText('Widget Content')).toBeDefined();
    expect(screen.queryByRole('button', { name: /action menu/i })).toBeNull();
  });

  it('renders action element when provided', () => {
    render(
      <WidgetWrapper title="Test Widget" action={<button aria-label="action menu">action menu</button>}>
        <p>Widget Content</p>
      </WidgetWrapper>
    );
    
    expect(screen.getByRole('button', { name: /action menu/i })).toBeDefined();
  });
});

const Boom: React.FC = () => {
  throw new Error('widget exploded')
}

describe('WidgetWrapper error containment', () => {
  it('shows a compact error inside the card instead of taking down the page', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <div>
        <WidgetWrapper title="Broken"><Boom /></WidgetWrapper>
        <span>still here</span>
      </div>,
    )
    expect(screen.getByText('still here')).toBeInTheDocument()
    expect(screen.getByText('Broken')).toBeInTheDocument()
    expect(screen.getByText(/could not be displayed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders children normally when nothing throws', () => {
    render(<WidgetWrapper title="Fine"><span>content</span></WidgetWrapper>)
    expect(screen.getByText('content')).toBeInTheDocument()
    expect(screen.queryByText(/could not be displayed/i)).toBeNull()
  })
})
