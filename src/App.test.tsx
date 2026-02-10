import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConvexProvider } from 'convex/react'
import App from './App'
import { convexClient } from './lib/convex'

describe('App', () => {
  it('renders login form by default', () => {
    render(
      <ConvexProvider client={convexClient}>
        <App />
      </ConvexProvider>,
    )
    expect(screen.getByRole('heading', { name: 'VibeCord' })).toBeInTheDocument()
    expect(screen.getByText('Login to access your account.')).toBeInTheDocument()
    expect(screen.getByLabelText('Login name')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })
})
