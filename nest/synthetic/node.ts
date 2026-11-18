import 'reflect-metadata'
import { Body, Controller, Get, Post, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node'

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

const app = await NestFactory.create<NestNodeApplication>(AppModule, new NodeAdapter(), { logger: false })
await app.listen(Number(process.env.PORT) || 3000, 'localhost')
