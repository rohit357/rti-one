import type { User } from '../domain/rti'
import { storage } from './storage'

const sessionKey = 'rti-one.session.v1'
const demoUser: User = { id: 'demo-citizen-01', name: 'Aarav Sharma', email: 'demo@rtione.in' }
const wait = () => new Promise(resolve => setTimeout(resolve, 250))

export const authService = {
  async login(email: string, password: string): Promise<User> {
    await wait()
    if (email !== 'demo@rtione.in' || password !== 'demo123') throw new Error('Use the demo credentials shown below.')
    storage.set(sessionKey, demoUser); return demoUser
  },
  getSession: () => storage.get<User>(sessionKey),
  logout: () => storage.remove(sessionKey)
}
