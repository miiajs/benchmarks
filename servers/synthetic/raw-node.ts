import { createServer, type IncomingMessage } from 'node:http'

const port = Number(process.env.PORT) || 3000
const getBody = JSON.stringify({ message: 'Hello, World!' })

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk })
    req.on('end', () => resolve(data))
  })
}

createServer(async (req, res) => {
  if (req.method === 'POST') {
    const { name } = JSON.parse(await readBody(req))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ id: crypto.randomUUID(), message: `Hello, ${name}!` }))
    return
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(getBody)
}).listen(port, 'localhost')
