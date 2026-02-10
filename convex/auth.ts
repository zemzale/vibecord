import { ConvexError, v } from 'convex/values'
import { mutation, query, type MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

const HASH_ITERATIONS = 120_000
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const CREDENTIALS_PROVIDER = 'credentials' as const

type AuthProvider = 'credentials' | 'google' | 'github'

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? [])
}

async function derivePasswordHash(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const salt = hexToBytes(saltHex)

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

function constantTimeEqual(leftHex: string, rightHex: string): boolean {
  if (leftHex.length !== rightHex.length) {
    return false
  }

  const left = hexToBytes(leftHex)
  const right = hexToBytes(rightHex)
  let mismatch = 0

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index]
  }

  return mismatch === 0
}

async function createSession(ctx: MutationCtx, userId: Id<'users'>) {
  const sessionToken = randomHex(32)
  const tokenHash = await sha256Hex(sessionToken)
  const createdAt = Date.now()
  const expiresAt = createdAt + SESSION_TTL_MS

  await ctx.db.insert('sessions', {
    userId,
    tokenHash,
    createdAt,
    expiresAt,
  })

  return sessionToken
}

async function upsertAuthAccount(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>
    provider: AuthProvider
    providerSubject: string
  },
) {
  const existing = await ctx.db
    .query('authAccounts')
    .withIndex('by_provider_subject', (q) =>
      q.eq('provider', args.provider).eq('providerSubject', args.providerSubject),
    )
    .unique()

  const timestamp = Date.now()

  if (existing) {
    if (existing.userId !== args.userId) {
      throw new ConvexError('Auth provider account is already linked to another user.')
    }

    await ctx.db.patch(existing._id, {
      lastUsedAt: timestamp,
    })
    return
  }

  await ctx.db.insert('authAccounts', {
    userId: args.userId,
    provider: args.provider,
    providerSubject: args.providerSubject,
    createdAt: timestamp,
    lastUsedAt: timestamp,
  })
}

async function findUserForProvider(
  ctx: MutationCtx,
  args: {
    provider: AuthProvider
    providerSubject: string
  },
) {
  const account = await ctx.db
    .query('authAccounts')
    .withIndex('by_provider_subject', (q) =>
      q.eq('provider', args.provider).eq('providerSubject', args.providerSubject),
    )
    .unique()

  if (!account) {
    return null
  }

  return ctx.db.get(account.userId)
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

    await upsertAuthAccount(ctx, {
      userId,
      provider: CREDENTIALS_PROVIDER,
      providerSubject: normalized,
    })

    const sessionToken = await createSession(ctx, userId)

    return {
      sessionToken,
      user: {
        id: userId,
        loginName: display,
      },
    }
  },
})

export const login = mutation({
  args: {
    loginName: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const { normalized } = normalizeLoginName(args.loginName)
    const password = args.password.trim()

    if (normalized.length < 3 || password.length < 8) {
      throw new ConvexError('Invalid login credentials.')
    }

    const accountUser = await findUserForProvider(ctx, {
      provider: CREDENTIALS_PROVIDER,
      providerSubject: normalized,
    })

    const user =
      accountUser ??
      (await ctx.db
        .query('users')
        .withIndex('by_login_name_lower', (q) => q.eq('loginNameLower', normalized))
        .unique())

    if (!user) {
      throw new ConvexError('Invalid login credentials.')
    }

    const candidateHash = await derivePasswordHash(password, user.passwordSalt)
    if (!constantTimeEqual(candidateHash, user.passwordHash)) {
      throw new ConvexError('Invalid login credentials.')
    }

    await upsertAuthAccount(ctx, {
      userId: user._id,
      provider: CREDENTIALS_PROVIDER,
      providerSubject: normalized,
    })

    const sessionToken = await createSession(ctx, user._id)

    return {
      sessionToken,
      user: {
        id: user._id,
        loginName: user.loginName,
      },
    }
  },
})

export const logout = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenHash = await sha256Hex(args.sessionToken)
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
      .unique()

    if (session) {
      await ctx.db.delete(session._id)
    }

    return { ok: true }
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
