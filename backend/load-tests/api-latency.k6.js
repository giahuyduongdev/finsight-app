import http from 'k6/http'
import { check, fail, group, sleep } from 'k6'

const baseUrl = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
const scenario = __ENV.LOAD_TEST_SCENARIO || 'smoke'
const vus = Number(__ENV.LOAD_TEST_VUS || '5')
const duration = __ENV.LOAD_TEST_DURATION || '1m'

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000']
  }
}

const jsonHeaders = {
  'Content-Type': 'application/json'
}

const parseJson = (res) => {
  try {
    return res.json()
  } catch (_error) {
    return null
  }
}

const authHeaders = (token) => ({
  ...jsonHeaders,
  Authorization: `Bearer ${token}`
})

const requireCredentials = () => {
  if (!__ENV.TEST_USER_EMAIL || !__ENV.TEST_USER_PASSWORD) {
    fail(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD are required for this scenario'
    )
  }
}

const login = () => {
  requireCredentials()

  const res = http.post(
    `${baseUrl}/api/v1/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_USER_EMAIL,
      password: __ENV.TEST_USER_PASSWORD
    }),
    { headers: jsonHeaders, tags: { name: 'POST /api/v1/auth/login' } }
  )

  const body = parseJson(res)
  const token = body?.data?.accessToken

  check(res, {
    'login status is 200': (response) => response.status === 200,
    'login returns access token': () =>
      typeof token === 'string' && token.length > 0
  })

  if (!token) fail('Login did not return data.accessToken')

  return token
}

const smokePublic = () => {
  group('public smoke', () => {
    const health = http.get(`${baseUrl}/health`, {
      tags: { name: 'GET /health' }
    })
    check(health, {
      'health is 200': (response) => response.status === 200
    })

    const ready = http.get(`${baseUrl}/ready`, {
      tags: { name: 'GET /ready' }
    })
    check(ready, {
      'ready is not 5xx': (response) => response.status < 500
    })

    const authCallback = http.get(`${baseUrl}/api/v1/auth/callback`, {
      redirects: 0,
      tags: { name: 'GET /api/v1/auth/callback' }
    })
    check(authCallback, {
      'auth callback returns redirect': (response) => response.status === 302
    })
  })
}

const readApis = (token) => {
  group('read APIs', () => {
    const headers = authHeaders(token)
    const requests = [
      ['GET /api/v1/users/me', `${baseUrl}/api/v1/users/me`],
      ['GET /api/v1/analytics/summary', `${baseUrl}/api/v1/analytics/summary`],
      ['GET /api/v1/analytics/chart', `${baseUrl}/api/v1/analytics/chart`],
      [
        'GET /api/v1/analytics/expense-breakdown',
        `${baseUrl}/api/v1/analytics/expense-breakdown`
      ],
      ['GET /api/v1/transactions/all', `${baseUrl}/api/v1/transactions/all`],
      ['GET /api/v1/reports', `${baseUrl}/api/v1/reports`]
    ]

    for (const [name, url] of requests) {
      const res = http.get(url, { headers, tags: { name } })
      check(res, {
        [`${name} is not 5xx`]: (response) => response.status < 500
      })
    }
  })
}

const writeTransaction = (token) => {
  group('write transaction API', () => {
    const headers = authHeaders(token)
    const marker = `load-test-${Date.now()}-${__VU}-${__ITER}`
    const payload = {
      title: marker,
      type: 'EXPENSE',
      amount: 1,
      currency: 'USD',
      category: 'Load Test',
      date: new Date().toISOString(),
      description: 'Disposable load-test transaction',
      isRecurring: false,
      paymentMethod: 'CASH',
      status: 'COMPLETED'
    }

    const createRes = http.post(
      `${baseUrl}/api/v1/transactions`,
      JSON.stringify(payload),
      { headers, tags: { name: 'POST /api/v1/transactions' } }
    )

    const created = parseJson(createRes)
    const id = created?.data?._id

    check(createRes, {
      'transaction create is 2xx': (response) =>
        response.status >= 200 && response.status < 300,
      'transaction create returns id': () => typeof id === 'string'
    })

    if (!id) return

    const updateRes = http.put(
      `${baseUrl}/api/v1/transactions/${id}`,
      JSON.stringify({
        description: 'Updated disposable load-test transaction'
      }),
      { headers, tags: { name: 'PUT /api/v1/transactions/:id' } }
    )
    check(updateRes, {
      'transaction update is not 5xx': (response) => response.status < 500
    })

    const deleteRes = http.del(`${baseUrl}/api/v1/transactions/${id}`, null, {
      headers,
      tags: { name: 'DELETE /api/v1/transactions/:id' }
    })
    check(deleteRes, {
      'transaction delete is not 5xx': (response) => response.status < 500
    })
  })
}

export function setup() {
  if (scenario === 'smoke-public') return { token: null }
  return { token: login() }
}

export default function (data) {
  if (scenario === 'smoke-public') {
    smokePublic()
    sleep(1)
    return
  }

  const token = data.token

  smokePublic()

  if (scenario === 'smoke') {
    sleep(1)
    return
  }

  if (scenario === 'read' || scenario === 'all') {
    readApis(token)
  }

  if (scenario === 'write' || scenario === 'all') {
    writeTransaction(token)
  }

  sleep(1)
}
