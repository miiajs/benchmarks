import { SignJWT, jwtVerify } from 'jose'

export const JWT_SECRET = 'benchmark-secret-key-for-testing-only'

const key = new TextEncoder().encode(JWT_SECRET)

export async function createToken(): Promise<string> {
  return new SignJWT({ sub: 'user-123', role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(new Date('2099-01-01').getTime() / 1000))
    .sign(key)
}

export async function verifyToken(token: string): Promise<{ sub: string; role: string }> {
  const { payload } = await jwtVerify(token, key)
  return payload as unknown as { sub: string; role: string }
}
