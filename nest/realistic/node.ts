import 'reflect-metadata'
import { Controller, Get, Post, Body, Param, Query, Req, HttpCode, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NodeAdapter, type NestNodeApplication, type NodeRequest } from '@nestjs/platform-node'
import { verifyToken } from '../../shared/jwt.js'

@Controller()
class AppController {
  @Get('/')
  health() {
    return { status: 'ok' }
  }

  @Get('/api/users/:userId/posts/:postId')
  async getPost(
    @Param('userId') userId: string,
    @Param('postId') postId: string,
    @Req() req: NodeRequest,
  ) {
    const user = await verifyToken(req.headers.authorization!.slice(7))
    return { userId, postId, user }
  }

  @Post('/api/workspaces/:workspaceId/projects/:projectId/tasks')
  @HttpCode(201)
  async createTask(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query('notify') notify: string,
    @Query('format') format: string,
    @Body() body: { title: string; priority: string },
    @Req() req: NodeRequest,
  ) {
    const user = await verifyToken(req.headers.authorization!.slice(7))
    return {
      id: crypto.randomUUID(),
      requestId: req.headers['x-request-id'],
      workspaceId,
      projectId,
      title: body.title,
      priority: body.priority,
      notify,
      format,
      createdBy: user.sub,
    }
  }
}

@Module({ controllers: [AppController] })
class AppModule {}

const app = await NestFactory.create<NestNodeApplication>(AppModule, new NodeAdapter(), { logger: false })
app.enableCors()
await app.listen(Number(process.env.PORT) || 3000, 'localhost')
