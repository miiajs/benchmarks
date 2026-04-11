import Fastify from 'fastify'
import cors from '@fastify/cors'
import { verifyToken } from '../../shared/jwt.js'

const app = Fastify({ logger: false })

await app.register(cors)

app.get('/', () => ({ status: 'ok' }))

app.get<{ Params: { userId: string; postId: string } }>(
  '/api/users/:userId/posts/:postId',
  async (req) => {
    const user = await verifyToken(req.headers.authorization!.slice(7))
    return { userId: req.params.userId, postId: req.params.postId, user }
  },
)

app.post<{ Params: { workspaceId: string; projectId: string }; Querystring: { notify: string; format: string }; Body: { title: string; priority: string } }>(
  '/api/workspaces/:workspaceId/projects/:projectId/tasks',
  async (req, reply) => {
    const user = await verifyToken(req.headers.authorization!.slice(7))
    const body = req.body as { title: string; priority: string }
    reply.code(201)
    return {
      id: crypto.randomUUID(),
      requestId: req.headers['x-request-id'],
      workspaceId: req.params.workspaceId,
      projectId: req.params.projectId,
      title: body.title,
      priority: body.priority,
      notify: req.query.notify,
      format: req.query.format,
      createdBy: user.sub,
    }
  },
)

app.listen({ port: Number(process.env.PORT) || 3000, host: 'localhost' })
