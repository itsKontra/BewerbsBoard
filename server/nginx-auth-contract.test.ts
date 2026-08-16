import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

const NGINX_CONTRACT_PATH = 'deploy/nginx-scoreboard.conf.example'

function locationBlock(configuration: string, declaration: string) {
  const opening = `location ${declaration} {`
  const start = configuration.indexOf(opening)

  if (start === -1) {
    throw new Error(`Missing nginx location: ${declaration}`)
  }

  const end = configuration.indexOf('\n}', start)

  if (end === -1) {
    throw new Error(`Unclosed nginx location: ${declaration}`)
  }

  return configuration.slice(start, end + 2)
}

describe('nginx authentication contract', () => {
  it('protects the admin document and every admin API through oauth2-proxy', async () => {
    const configuration = await readFile(NGINX_CONTRACT_PATH, 'utf8')

    for (const declaration of ['= /admin', '/admin/', '/api/admin/', '= /api/admin']) {
      expect(locationBlock(configuration, declaration)).toContain('auth_request /oauth2/auth;')
    }
  })

  it('redirects unauthenticated admin pages and overwrites API identity from the auth response', async () => {
    const configuration = await readFile(NGINX_CONTRACT_PATH, 'utf8')
    const admin = locationBlock(configuration, '= /admin')
    const oauth2 = locationBlock(configuration, '/oauth2/')

    expect(admin).toMatch(/error_page 401 = (\/oauth2\/sign_in|@oauth2_signin);/)
    expect(oauth2).toContain('proxy_set_header X-Auth-Request-Redirect')

    for (const declaration of ['/api/admin/', '= /api/admin']) {
      const apiAdmin = locationBlock(configuration, declaration)

      expect(apiAdmin).toContain(
        'auth_request_set $authenticated_email $upstream_http_x_auth_request_email;',
      )
      expect(apiAdmin).toContain('proxy_set_header X-Auth-Request-Email $authenticated_email;')
      expect(apiAdmin).toContain('proxy_set_header X-Auth-Request-User $authenticated_user;')
      expect(apiAdmin).toContain(
        'proxy_set_header X-Auth-Request-Preferred-Username $authenticated_preferred_username;',
      )
      expect(apiAdmin).toContain('proxy_set_header X-Auth-Request-Roles $authenticated_roles;')
      expect(apiAdmin).toContain('proxy_set_header X-Auth-Request-Groups $authenticated_groups;')
      expect(apiAdmin).not.toContain('error_page 401')
    }

    expect(configuration).not.toContain('$http_x_auth_request_email')
  })

  it('keeps public routes outside auth_request and strips proxy identity', async () => {
    const configuration = await readFile(NGINX_CONTRACT_PATH, 'utf8')
    const publicRoutes = locationBlock(configuration, '/')

    expect(publicRoutes).toContain('proxy_set_header X-Auth-Request-Email "";')
    expect(publicRoutes).toContain('proxy_set_header X-Auth-Request-User "";')
    expect(publicRoutes).toContain('proxy_set_header X-Auth-Request-Preferred-Username "";')
    expect(publicRoutes).toContain('proxy_set_header X-Auth-Request-Roles "";')
    expect(publicRoutes).toContain('proxy_set_header X-Auth-Request-Groups "";')
    expect(publicRoutes).toMatch(/proxy_pass http:\/\/[^;]+:3080;/)
    expect(publicRoutes).not.toContain('auth_request')
  })
})
