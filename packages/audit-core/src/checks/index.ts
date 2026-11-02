import type { Check } from '../types'
import { auth001 } from './auth-001'
import { auth002 } from './auth-002'
import { secret001 } from './secret-001'

export const ALL_CHECKS: Check[] = [auth001, auth002, secret001]

export { auth001, auth002, secret001 }
