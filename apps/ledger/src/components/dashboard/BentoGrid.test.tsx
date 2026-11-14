import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BentoGrid } from './BentoGrid';

describe('BentoGrid', () => {
  it('renders children with correct grid layout classes', () => {
    const { container } = render(
      <BentoGrid>
        <div data-testid="child">1</div>
        <div data-testid="child">2</div>
      </BentoGrid>
    );
    
    expect(screen.getAllByTestId('child')).toHaveLength(2);
    expect(container.firstChild).toHaveClass('grid');
    expect(container.firstChild).toHaveClass('grid-cols-1');
    expect(container.firstChild).toHaveClass('gap-6');
  });
});
