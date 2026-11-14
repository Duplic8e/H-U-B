import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AppearancePicker } from './AppearancePicker'
import { useThemeStore } from '../../store/useThemeStore'

describe('AppearancePicker', () => {
  beforeEach(() => useThemeStore.getState().setPreference('system'))

  it('offers System, Light and Dark with the current one checked', () => {
    render(<AppearancePicker />)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'false')
  })

  it('pins a theme on tap', () => {
    render(<AppearancePicker />)
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(useThemeStore.getState()).toMatchObject({ preference: 'dark', theme: 'dark' })
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }))
    expect(useThemeStore.getState()).toMatchObject({ preference: 'light', theme: 'light' })
  })
})
