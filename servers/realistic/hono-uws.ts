import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@miiajs/uws-server'
import { verifyToken } from '../../shared/jwt.js'

const app = new Hono()

app.use(cors())

app.get('/', (c) => c.json({ status: 'ok' }))

app.get('/api/users/:userId/posts/:postId', async (c) => {
  const user = await verifyToken(c.req.header('authorization')!.slice(7))
  const { userId, postId } = c.req.param()
  return c.json({ userId, postId, user })
})

app.post('/api/workspaces/:workspaceId/projects/:projectId/tasks', async (c) => {
  const user = await verifyToken(c.req.header('authorization')!.slice(7))
  const body = (await c.req.json()) as { title: string; priority: string }
  const { workspaceId, projectId } = c.req.param()
  c.status(201)
  return c.json({
    id: crypto.randomUUID(),
    requestId: c.req.header('x-request-id'),
    workspaceId,
    projectId,
    title: body.title,
    priority: body.priority,
    notify: c.req.query('notify'),
    format: c.req.query('format'),
    createdBy: user.sub,
  })
})

const port = Number(process.env.PORT) || 3000
serve({ fetch: app.fetch, port, hostname: 'localhost' })
