function App() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10 text-slate-900">
      <h1 className="text-3xl font-semibold tracking-tight">VibeCord Foundation</h1>
      <p className="text-base text-slate-600">
        This baseline is ready for the first MVP stories with TypeScript, Vite, TanStack Start dependency wiring, Tailwind CSS, and Convex client setup.
      </p>
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-lg font-medium">Stack status</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>TypeScript + Vite app scaffolded with Bun scripts</li>
          <li>Tailwind CSS is active and styles render from utility classes</li>
          <li>@tanstack/react-start installed for route framework integration in upcoming stories</li>
          <li>Convex React client/provider configured from env</li>
        </ul>
      </section>
      <section className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm text-slate-700">
          <span className="font-medium">Convex URL:</span>{' '}
          {convexUrl ? convexUrl : 'Set VITE_CONVEX_URL in your environment'}
        </p>
      </section>
    </main>
  )
}

export default App
