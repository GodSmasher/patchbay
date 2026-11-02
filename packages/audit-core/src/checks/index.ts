import type { Check } from '../types'
import { auth001 } from './auth-001'
import { auth002 } from './auth-002'
import { auth003 } from './auth-003'
import { auth004 } from './auth-004'
import { auth005 } from './auth-005'
import { redirect001 } from './redirect-001'
import { scope001 } from './scope-001'
import { scope002 } from './scope-002'
import { secret001 } from './secret-001'
import { secret002 } from './secret-002'
import { transport001 } from './transport-001'
import { transport002 } from './transport-002'

export const ALL_CHECKS: Check[] = [
  auth001,
  auth002,
  auth003,
  auth004,
  auth005,
  scope001,
  scope002,
  secret001,
  secret002,
  transport001,
  transport002,
  redirect001,
]

export { auth001, auth002, auth003, auth004, auth005, redirect001, scope001, scope002, secret001, secret002, transport001, transport002 }
