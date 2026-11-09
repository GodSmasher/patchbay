import type { Check } from '../types'
import { audience001 } from './audience-001'
import { auth001 } from './auth-001'
import { auth002 } from './auth-002'
import { auth003 } from './auth-003'
import { auth004 } from './auth-004'
import { auth005 } from './auth-005'
import { auth006 } from './auth-006'
import { manifest001 } from './manifest-001'
import { probe001 } from './probe-001'
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
  auth006,
  audience001,
  scope001,
  scope002,
  secret001,
  secret002,
  transport001,
  transport002,
  redirect001,
  manifest001,
  probe001,
]

export {
  audience001,
  auth001, auth002, auth003, auth004, auth005, auth006,
  manifest001,
  probe001, redirect001, scope001, scope002, secret001, secret002, transport001, transport002,
}
