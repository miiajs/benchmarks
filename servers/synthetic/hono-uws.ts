import { Hono } from 'hono'
import { serve } from '@miiajs/uws-server'

const app = new Hono()

app.get('/', (c) => c.json({ message: 'Hello, World!' }))

app.post('/json', async (c) => {
  const { name } = (await c.req.json()) as { name: string }
  return c.json({ id: crypto.randomUUID(), message: `Hello, ${name}!` })
})

const port = Number(process.env.PORT) || 3000
serve({ fetch: app.fetch, port, hostname: 'localhost' })
