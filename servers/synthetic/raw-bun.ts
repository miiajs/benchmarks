const port = Number(process.env.PORT) || 3000

Bun.serve({
  port,
  hostname: 'localhost',
  async fetch(req) {
    if (req.method === 'POST') {
      const { name } = (await req.json()) as { name: string }
      return Response.json({ id: crypto.randomUUID(), message: `Hello, ${name}!` })
    }
    return Response.json({ message: 'Hello, World!' })
  },
})
