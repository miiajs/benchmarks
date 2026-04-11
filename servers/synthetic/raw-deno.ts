const port = Number(Deno.env.get('PORT')) || 3000

Deno.serve({ port, hostname: 'localhost' }, async (req) => {
  if (req.method === 'POST') {
    const { name } = (await req.json()) as { name: string }
    return Response.json({ id: crypto.randomUUID(), message: `Hello, ${name}!` })
  }
  return Response.json({ message: 'Hello, World!' })
})
