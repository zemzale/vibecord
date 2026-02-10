import { ConvexReactClient } from 'convex/react'

const defaultConvexUrl = 'https://placeholder.convex.cloud'

export const convexClient = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL ?? defaultConvexUrl,
)
