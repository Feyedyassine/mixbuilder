import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '@/ui/App'

describe('App', () => {
  it('renders the app shell', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'djmix' })).toBeInTheDocument()
  })
})
