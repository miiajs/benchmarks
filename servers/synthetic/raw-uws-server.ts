import { serve } from '@miiajs/uws-server'

const getBody = JSON.stringify({ message: 'Hello, World!' })
const port = Number(process.env.PORT) || 3000

serve({
  port,
  hostname: 'localhost',
  async fetch(req) {
    if (req.method === 'POST') {
      const { name } = (await req.json()) as { name: string }
      return new Response(
        JSON.stringify({ id: crypto.randomUUID(), message: `Hello, ${name}!` }),
        { headers: { 'content-type': 'application/json' } },
      )
    }
    return new Response(getBody, { headers: { 'content-type': 'application/json' } })
  },
})
