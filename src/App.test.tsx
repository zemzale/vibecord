import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConvexProvider } from 'convex/react'
import App from './App'
import { convexClient } from './lib/convex'

describe('App', () => {
  it('renders register form fields', () => {
    render(
      <ConvexProvider client={convexClient}>
        <App />
      </ConvexProvider>,
    )
    expect(screen.getByRole('heading', { name: 'Create your VibeCord account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Login name')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })
})
