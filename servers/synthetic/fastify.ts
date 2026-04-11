import Fastify from 'fastify'

const app = Fastify({ logger: false })

app.get('/', () => ({ message: 'Hello, World!' }))

app.post('/json', async (req) => ({
  id: crypto.randomUUID(),
  message: `Hello, ${(req.body as { name: string }).name}!`,
}))

app.listen({ port: Number(process.env.PORT) || 3000, host: 'localhost' })
