import { Controller, Get, Post, Status, Miia, Module, cors, type RequestContext } from '@miiajs/core'
import { verifyToken } from '../../shared/jwt.js'

@Controller()
class HealthController {
  @Get('/')
  health() {
    return { status: 'ok' }
  }
}

@Controller('/api/users')
class UsersController {
  @Get('/:userId/posts/:postId')
  async getPost(ctx: RequestContext) {
    const user = await verifyToken(ctx.req.headers.get('authorization')!.slice(7))
    return { userId: ctx.params.userId, postId: ctx.params.postId, user }
  }
}

@Controller('/api/workspaces')
class TasksController {
  @Post('/:workspaceId/projects/:projectId/tasks')
  @Status(201)
  async createTask(ctx: RequestContext) {
    const user = await verifyToken(ctx.req.headers.get('authorization')!.slice(7))
    const body = (await ctx.req.json()) as { title: string; priority: string }
    return {
      id: crypto.randomUUID(),
      requestId: ctx.req.headers.get('x-request-id'),
      workspaceId: ctx.params.workspaceId,
      projectId: ctx.params.projectId,
      title: body.title,
      priority: body.priority,
      notify: ctx.query.notify,
      format: ctx.query.format,
      createdBy: user.sub,
    }
  }
}

@Module({ controllers: [HealthController, UsersController, TasksController] })
class AppModule {}

const app = new Miia({ logger: false }).use(cors()).register(AppModule)

const port = Number(process.env.PORT) || 3000

if ('Bun' in globalThis || 'Deno' in globalThis) {
  await app.listen(port, 'localhost')
} else {
  const { serve } = await import('@miiajs/node-server')
  await app.listen(port, 'localhost', serve)
}
