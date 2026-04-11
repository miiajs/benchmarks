import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.json({ message: 'Hello, World!' }))

app.post('/json', async (c) => {
  const { name } = (await c.req.json()) as { name: string }
  return c.json({ id: crypto.randomUUID(), message: `Hello, ${name}!` })
})

const port = Number(
  'Deno' in globalThis ? (globalThis as any).Deno.env.get('PORT') : process.env.PORT,
) || 3000

if ('Bun' in globalThis) {
  ;(globalThis as any).Bun.serve({ fetch: app.fetch, port, hostname: 'localhost' })
} else if ('Deno' in globalThis) {
  ;(globalThis as any).Deno.serve({ port, hostname: 'localhost' }, app.fetch)
} else {
  const { serve } = await import('@hono/node-server')
  serve({ fetch: app.fetch, port, hostname: 'localhost' })
}
