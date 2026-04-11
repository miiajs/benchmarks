import { Elysia } from 'elysia'

new Elysia()
  .get('/', () => ({ message: 'Hello, World!' }))
  .post('/json', ({ body }) => ({
    id: crypto.randomUUID(),
    message: `Hello, ${(body as { name: string }).name}!`,
  }))
  .listen({ port: Number(process.env.PORT) || 3000, hostname: 'localhost' })
