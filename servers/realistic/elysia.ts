import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { verifyToken } from '../../shared/jwt.js'

new Elysia()
  .use(cors())
  .get('/', () => ({ status: 'ok' }))
  .get('/api/users/:userId/posts/:postId', async ({ params, headers }) => {
    const user = await verifyToken(headers.authorization!.slice(7))
    return { userId: params.userId, postId: params.postId, user }
  })
  .post('/api/workspaces/:workspaceId/projects/:projectId/tasks', async ({ params, headers, body, query, set }) => {
    const user = await verifyToken(headers.authorization!.slice(7))
    const b = body as { title: string; priority: string }
    set.status = 201
    return {
      id: crypto.randomUUID(),
      requestId: headers['x-request-id'],
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      title: b.title,
      priority: b.priority,
      notify: (query as Record<string, string>).notify,
      format: (query as Record<string, string>).format,
      createdBy: user.sub,
    }
  })
  .listen({ port: Number(process.env.PORT) || 3000, hostname: 'localhost' })
