import { Controller, Get, Post, Miia, Module, type RequestContext } from '@miiajs/core'

@Controller()
class HelloController {
  @Get('/')
  hello() {
    return { message: 'Hello, World!' }
  }

  @Post('/json')
  async json(ctx: RequestContext) {
    const { name } = (await ctx.req.json()) as { name: string }
    return { id: crypto.randomUUID(), message: `Hello, ${name}!` }
  }
}

@Module({ controllers: [HelloController] })
class AppModule {}

const port = Number(process.env.PORT) || 3000
const app = new Miia({ logger: false }).register(AppModule)
const { serve } = await import('@miiajs/uws-server')
await app.listen(port, 'localhost', serve)
