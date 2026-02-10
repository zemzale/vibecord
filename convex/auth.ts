import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'

const HASH_ITERATIONS = 120_000
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

async function derivePasswordHash(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? [])

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: HASH_ITERATIONS,
    },
    key,
    256,
  )

  return bytesToHex(new Uint8Array(bits))
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

function normalizeLoginName(loginName: string): { display: string; normalized: string } {
  const display = loginName.trim()
  return { display, normalized: display.toLowerCase() }
}

export const register = mutation({
  args: {
    loginName: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const { display, normalized } = normalizeLoginName(args.loginName)
    const password = args.password.trim()

    if (display.length < 3 || display.length > 24) {
      throw new ConvexError('Login name must be between 3 and 24 characters.')
    }

    if (!/^[a-zA-Z0-9_]+$/.test(display)) {
      throw new ConvexError('Login name may only contain letters, numbers, and underscore.')
    }

    if (password.length < 8) {
      throw new ConvexError('Password must be at least 8 characters long.')
    }

    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_login_name_lower', (q) => q.eq('loginNameLower', normalized))
      .unique()

    if (existingUser) {
      throw new ConvexError('Login name is already in use.')
    }

    const passwordSalt = randomHex(16)
    const passwordHash = await derivePasswordHash(password, passwordSalt)
    const createdAt = Date.now()

    const userId = await ctx.db.insert('users', {
      loginName: display,
      loginNameLower: normalized,
      passwordHash,
      passwordSalt,
      createdAt,
    })

    const sessionToken = randomHex(32)
    const tokenHash = await sha256Hex(sessionToken)
    const expiresAt = createdAt + SESSION_TTL_MS

    await ctx.db.insert('sessions', {
      userId,
      tokenHash,
      createdAt,
      expiresAt,
    })

    return {
      sessionToken,
      user: {
        id: userId,
        loginName: display,
      },
    }
  },
})

export const getSessionUser = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenHash = await sha256Hex(args.sessionToken)
    const now = Date.now()
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
      .unique()

    if (!session || session.expiresAt < now) {
      return null
    }

    const user = await ctx.db.get(session.userId)
    if (!user) {
      return null
    }

    return {
      id: user._id,
      loginName: user.loginName,
    }
  },
})
