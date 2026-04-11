import 'reflect-metadata'
import { Body, Controller, Get, Post, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'

@Controller()
class AppController {
  @Get('/')
  hello() {
    return { message: 'Hello, World!' }
  }

  @Post('/json')
  json(@Body() body: { name: string }) {
    return { id: crypto.randomUUID(), message: `Hello, ${body.name}!` }
  }
}

@Module({ controllers: [AppController] })
class AppModule {}

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false })
await app.listen({ port: Number(process.env.PORT) || 3000, host: 'localhost' })
