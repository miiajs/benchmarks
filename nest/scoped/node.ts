import 'reflect-metadata'
import { Controller, Get, Inject, Injectable, Module, Scope } from '@nestjs/common'
import { NestFactory, REQUEST } from '@nestjs/core'
import { NodeAdapter, type NestNodeApplication, type NodeRequest } from '@nestjs/platform-node'

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

@Injectable({ scope: Scope.REQUEST })
class RequestUser {
  constructor(
    @Inject(REQUEST) private readonly req: NodeRequest,
    @Inject(UsersRepo) private readonly users: UsersRepo,
  ) {}

  get user() {
    return this.users.find(this.req.headers['x-user-id'] as string)
  }
}

@Controller()
class AppController {
  constructor(@Inject(RequestUser) private readonly current: RequestUser) {}

  @Get('/')
  health() {
    return { status: 'ok' }
  }

  @Get('/scoped')
  scoped() {
    return this.current.user
  }
}

@Module({ controllers: [AppController], providers: [UsersRepo, RequestUser] })
class AppModule {}

const app = await NestFactory.create<NestNodeApplication>(AppModule, new NodeAdapter(), { logger: false })
await app.listen(Number(process.env.PORT) || 3000, 'localhost')
