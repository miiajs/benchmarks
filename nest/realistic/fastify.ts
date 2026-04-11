import 'reflect-metadata'
import { Controller, Get, Post, Body, Param, Query, Req, HttpCode, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import type { FastifyRequest } from 'fastify'
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
    @Req() req: FastifyRequest,
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
    @Req() req: FastifyRequest,
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

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false })
app.enableCors()
await app.listen({ port: Number(process.env.PORT) || 3000, host: 'localhost' })
