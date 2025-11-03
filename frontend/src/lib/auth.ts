// Local demo auth using localStorage (not secure)
export const STORAGE_KEYS = {
  users: 'gb_users',
  session: 'gb_session',
  plans: 'gb_plans',
} as const

export type User = {
  id: string
  email: string
  name?: string
  password: string
}

function readUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.users)
    return raw ? (JSON.parse(raw) as User[]) : []
  } catch {
    return []
  }
}

function writeUsers(users: User[]) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users))
}

export function getCurrentUser(): User | null {
  const id = localStorage.getItem(STORAGE_KEYS.session)
  if (!id) return null
  return readUsers().find(u => u.id === id) ?? null
}

export function isAuthenticated(): boolean {
  return !!getCurrentUser()
}

export function logout() {
  localStorage.removeItem(STORAGE_KEYS.session)
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function register(email: string, password: string, name?: string) {
  email = email.trim().toLowerCase()
  if (!email || !password) return { ok: false as const, error: 'Email and password required' }
  const users = readUsers()
  if (users.some(u => u.email === email)) return { ok: false as const, error: 'Email already registered' }
  const user: User = { id: generateId(), email, name, password }
  users.push(user)
  writeUsers(users)
  localStorage.setItem(STORAGE_KEYS.session, user.id)
  return { ok: true as const, user }
}

export function login(email: string, password: string) {
  email = email.trim().toLowerCase()
  const user = readUsers().find(u => u.email === email && u.password === password)
  if (!user) return { ok: false as const, error: 'Invalid credentials' }
  localStorage.setItem(STORAGE_KEYS.session, user.id)
  return { ok: true as const, user }
}

// ---- Plan storage (local-only, per user) ----
export type PlanTier = 'free' | 'pro' | 'team' | 'api'

function readPlans(): Record<string, PlanTier> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.plans)
    return raw ? (JSON.parse(raw) as Record<string, PlanTier>) : {}
  } catch {
    return {}
  }
}

function writePlans(plans: Record<string, PlanTier>) {
  localStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(plans))
}

export function getCurrentPlan(): PlanTier {
  const u = getCurrentUser()
  if (!u) return 'free'
  const plans = readPlans()
  return plans[u.id] ?? 'free'
}

export function setCurrentPlan(tier: PlanTier) {
  const u = getCurrentUser()
  if (!u) return
  const plans = readPlans()
  plans[u.id] = tier
  writePlans(plans)
}
