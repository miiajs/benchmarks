import { Controller, Get, Injectable, Miia, Module, inject, REQUEST_CONTEXT, type RequestContext } from '@miiajs/core'

interface User {
  id: string
  name: string
}

@Injectable()
class UsersRepo {
  private users = new Map<string, User>([
    ['1', { id: '1', name: 'Ada' }],
    ['7', { id: '7', name: 'Grace' }],
    ['42', { id: '42', name: 'Douglas' }],
    ['99', { id: '99', name: 'Linus' }],
  ])

  find(id: string) {
    return this.users.get(id)
  }
}

@Injectable({ scope: 'request' })
class RequestUser {
  private ctx = inject(REQUEST_CONTEXT)
  private users = inject(UsersRepo)

  get user() {
    return this.users.find(this.ctx.req.headers.get('x-user-id')!)
  }
}

@Controller()
class ScopedController {
  @Get('/')
  health() {
    return { status: 'ok' }
  }

  @Get('/scoped')
  scoped(ctx: RequestContext) {
    return ctx.resolve(RequestUser).user
  }
}

@Module({ controllers: [ScopedController], providers: [UsersRepo, RequestUser] })
class AppModule {}

const port = Number(process.env.PORT) || 3000
const app = new Miia({ logger: false }).register(AppModule)
const { serve } = await import('@miiajs/uws-server')
await app.listen(port, 'localhost', serve)
