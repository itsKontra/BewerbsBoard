export function proxyAuditActor(request: Request): string | null {
  const email = request.headers.get('X-Auth-Request-Email')?.trim().toLowerCase()
  if (email && /^[^@\s]+@[^@\s]+$/.test(email)) {
    return email
  }
  const preferredUsername = request.headers.get('X-Auth-Request-Preferred-Username')?.trim()
  if (preferredUsername) {
    return preferredUsername
  }
  const user = request.headers.get('X-Auth-Request-User')?.trim()
  if (user) {
    return user
  }
  return null
}

export function hasAdminRole(request: Request, requiredRole: string = 'admin'): boolean {
  const roleHeaders = [
    'X-Auth-Request-Roles',
    'X-Auth-Request-Groups',
    'X-Forwarded-Roles',
    'X-Forwarded-Groups',
  ]

  const normalizedRequiredRole = requiredRole.trim().toLowerCase()

  for (const headerName of roleHeaders) {
    const rawValue = request.headers.get(headerName)
    if (!rawValue) continue

    const trimmed = rawValue.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          const found = parsed.some((item) => matchesRole(String(item), normalizedRequiredRole))
          if (found) return true
        }
      } catch {
        // Fall back to string splitting if JSON parsing fails
      }
    }

    const tokens = trimmed.split(/[\s,]+/)
    for (const token of tokens) {
      if (matchesRole(token, normalizedRequiredRole)) {
        return true
      }
    }
  }

  return false
}

function matchesRole(candidate: string, requiredRole: string): boolean {
  let clean = candidate.trim().toLowerCase()
  if (!clean) return false
  if (clean.startsWith('[') && clean.endsWith(']')) {
    clean = clean.slice(1, -1).trim()
  }
  if (clean === requiredRole) return true
  if (clean === `role_${requiredRole}`) return true
  if (clean === `role:${requiredRole}`) return true
  if (clean.endsWith(`:${requiredRole}`)) return true
  if (clean === `/${requiredRole}`) return true
  if (clean.endsWith(`/${requiredRole}`)) return true
  return false
}


