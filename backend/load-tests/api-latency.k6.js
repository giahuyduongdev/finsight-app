import http from 'k6/http'
import { check, fail, group, sleep } from 'k6'

const baseUrl = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
const scenario = __ENV.LOAD_TEST_SCENARIO || 'smoke'
const vus = Number(__ENV.LOAD_TEST_VUS || '5')
const duration = __ENV.LOAD_TEST_DURATION || '1m'
const enableEmailScenarios = __ENV.ENABLE_EMAIL_SCENARIOS === 'true'
const enableProviderScenarios = __ENV.ENABLE_PROVIDER_SCENARIOS === 'true'
const enablePasswordMutationScenarios =
  __ENV.ENABLE_PASSWORD_MUTATION_SCENARIOS === 'true'
const receiptFixture =
  enableProviderScenarios && __ENV.RECEIPT_FIXTURE_PATH
    ? open(__ENV.RECEIPT_FIXTURE_PATH, 'b')
    : null

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

const checkNot5xx = (name, res) =>
  check(res, {
    [`${name} is not 5xx`]: (response) => response.status < 500
  })

const check2xx = (name, res) =>
  check(res, {
    [`${name} is 2xx`]: (response) =>
      response.status >= 200 && response.status < 300
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
  const refreshToken = res.cookies?.refreshToken?.[0]?.value

  check(res, {
    'login status is 200': (response) => response.status === 200,
    'login returns access token': () =>
      typeof token === 'string' && token.length > 0
  })

  if (!token) fail('Login did not return data.accessToken')

  return { token, refreshToken }
}

const transactionPayload = (marker) => ({
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
})

const createTransaction = (token, marker) => {
  const res = http.post(
    `${baseUrl}/api/v1/transactions`,
    JSON.stringify(transactionPayload(marker)),
    {
      headers: authHeaders(token),
      tags: { name: 'POST /api/v1/transactions' }
    }
  )

  const body = parseJson(res)
  const id = body?.data?._id

  check(res, {
    'transaction create is 2xx': (response) =>
      response.status >= 200 && response.status < 300,
    'transaction create returns id': () => typeof id === 'string'
  })

  return id
}

const deleteTransaction = (token, id) => {
  if (!id) return

  const res = http.del(`${baseUrl}/api/v1/transactions/${id}`, null, {
    headers: authHeaders(token),
    tags: { name: 'DELETE /api/v1/transactions/:id' }
  })

  check(res, {
    'transaction delete is not 5xx': (response) => response.status < 500
  })
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

    const oauth = http.get(`${baseUrl}/api/v1/auth/oauth/google`, {
      redirects: 0,
      tags: { name: 'GET /api/v1/auth/oauth/:provider' }
    })
    check(oauth, {
      'oauth redirect returns 302': (response) => response.status === 302
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

const authCoreApis = () => {
  group('auth core APIs', () => {
    const session = login()

    if (session.refreshToken) {
      const refresh = http.post(
        `${baseUrl}/api/v1/auth/refresh-token`,
        JSON.stringify({ refreshToken: session.refreshToken }),
        {
          headers: jsonHeaders,
          tags: { name: 'POST /api/v1/auth/refresh-token' }
        }
      )
      check2xx('refresh token', refresh)
    }

    const logout = http.post(
      `${baseUrl}/api/v1/auth/logout`,
      JSON.stringify({ refreshToken: session.refreshToken }),
      {
        headers: authHeaders(session.token),
        tags: { name: 'POST /api/v1/auth/logout' }
      }
    )
    check2xx('logout', logout)

    const logoutAllSession = login()
    const logoutAll = http.post(`${baseUrl}/api/v1/auth/logout-all`, null, {
      headers: authHeaders(logoutAllSession.token),
      tags: { name: 'POST /api/v1/auth/logout-all' }
    })
    check2xx('logout all', logoutAll)
  })
}

const userPasswordMutationOptionalApi = (token) => {
  if (!enablePasswordMutationScenarios || !__ENV.TEST_TEMP_PASSWORD) return

  group('user password mutation optional API', () => {
    const changeToTemp = http.put(
      `${baseUrl}/api/v1/users/change-password`,
      JSON.stringify({
        currentPassword: __ENV.TEST_USER_PASSWORD,
        newPassword: __ENV.TEST_TEMP_PASSWORD,
        confirmPassword: __ENV.TEST_TEMP_PASSWORD
      }),
      {
        headers: authHeaders(token),
        tags: { name: 'PUT /api/v1/users/change-password' }
      }
    )
    checkNot5xx('PUT /api/v1/users/change-password', changeToTemp)

    if (changeToTemp.status < 200 || changeToTemp.status >= 300) return

    const tempLogin = http.post(
      `${baseUrl}/api/v1/auth/login`,
      JSON.stringify({
        email: __ENV.TEST_USER_EMAIL,
        password: __ENV.TEST_TEMP_PASSWORD
      }),
      { headers: jsonHeaders, tags: { name: 'POST /api/v1/auth/login' } }
    )
    const tempToken = parseJson(tempLogin)?.data?.accessToken
    check(tempLogin, {
      'temp password login is 200': (response) => response.status === 200,
      'temp password login returns access token': () =>
        typeof tempToken === 'string' && tempToken.length > 0
    })

    if (!tempToken) return

    const restoreOriginal = http.put(
      `${baseUrl}/api/v1/users/change-password`,
      JSON.stringify({
        currentPassword: __ENV.TEST_TEMP_PASSWORD,
        newPassword: __ENV.TEST_USER_PASSWORD,
        confirmPassword: __ENV.TEST_USER_PASSWORD
      }),
      {
        headers: authHeaders(tempToken),
        tags: { name: 'PUT /api/v1/users/change-password' }
      }
    )
    check2xx('restore original password', restoreOriginal)
  })
}

const userProfileApis = (token) => {
  group('user profile APIs', () => {
    const headers = authHeaders(token)

    const me = http.get(`${baseUrl}/api/v1/users/me`, {
      headers,
      tags: { name: 'GET /api/v1/users/me' }
    })
    checkNot5xx('GET /api/v1/users/me', me)

    const patchMe = http.patch(
      `${baseUrl}/api/v1/users/me`,
      JSON.stringify({
        timezone: 'UTC',
        preferredCurrency: 'USD'
      }),
      { headers, tags: { name: 'PATCH /api/v1/users/me' } }
    )
    checkNot5xx('PATCH /api/v1/users/me', patchMe)
  })
}

const analyticsApis = (token) => {
  group('analytics APIs', () => {
    const headers = authHeaders(token)
    const requests = [
      ['GET /api/v1/analytics/summary', `${baseUrl}/api/v1/analytics/summary`],
      ['GET /api/v1/analytics/chart', `${baseUrl}/api/v1/analytics/chart`],
      [
        'GET /api/v1/analytics/expense-breakdown',
        `${baseUrl}/api/v1/analytics/expense-breakdown`
      ],
      ['GET /api/v1/analytics/rates', `${baseUrl}/api/v1/analytics/rates`]
    ]

    for (const [name, url] of requests) {
      const res = http.get(url, { headers, tags: { name } })
      checkNot5xx(name, res)
    }

    const refreshRates = http.post(
      `${baseUrl}/api/v1/analytics/rates/refresh`,
      null,
      {
        headers,
        tags: { name: 'POST /api/v1/analytics/rates/refresh' }
      }
    )
    checkNot5xx('POST /api/v1/analytics/rates/refresh', refreshRates)
  })
}

const readApis = (token) => {
  group('read APIs', () => {
    userProfileApis(token)
    analyticsApis(token)

    const headers = authHeaders(token)
    const transactions = http.get(`${baseUrl}/api/v1/transactions/all`, {
      headers,
      tags: { name: 'GET /api/v1/transactions/all' }
    })
    checkNot5xx('GET /api/v1/transactions/all', transactions)

    const reports = http.get(`${baseUrl}/api/v1/reports`, {
      headers,
      tags: { name: 'GET /api/v1/reports' }
    })
    checkNot5xx('GET /api/v1/reports', reports)
  })
}

const transactionFullApis = (token) => {
  group('transaction full APIs', () => {
    const headers = authHeaders(token)
    const marker = `load-test-${Date.now()}-${__VU}-${__ITER}`
    const id = createTransaction(token, marker)

    if (!id) return

    const getById = http.get(`${baseUrl}/api/v1/transactions/${id}`, {
      headers,
      tags: { name: 'GET /api/v1/transactions/:id' }
    })
    checkNot5xx('GET /api/v1/transactions/:id', getById)

    const children = http.get(`${baseUrl}/api/v1/transactions/${id}/children`, {
      headers,
      tags: { name: 'GET /api/v1/transactions/:id/children' }
    })
    checkNot5xx('GET /api/v1/transactions/:id/children', children)

    const update = http.put(
      `${baseUrl}/api/v1/transactions/${id}`,
      JSON.stringify({
        description: 'Updated disposable load-test transaction'
      }),
      { headers, tags: { name: 'PUT /api/v1/transactions/:id' } }
    )
    checkNot5xx('PUT /api/v1/transactions/:id', update)

    const duplicate = http.post(
      `${baseUrl}/api/v1/transactions/${id}/duplicate`,
      null,
      { headers, tags: { name: 'POST /api/v1/transactions/:id/duplicate' } }
    )
    checkNot5xx('POST /api/v1/transactions/:id/duplicate', duplicate)
    const duplicateId = parseJson(duplicate)?.data?._id

    const bulk = http.post(
      `${baseUrl}/api/v1/transactions/bulk`,
      JSON.stringify({
        transactions: [transactionPayload(`${marker}-bulk`)]
      }),
      { headers, tags: { name: 'POST /api/v1/transactions/bulk' } }
    )
    checkNot5xx('POST /api/v1/transactions/bulk', bulk)

    deleteTransaction(token, duplicateId)
    deleteTransaction(token, id)

    const bulkDeleteId = createTransaction(token, `${marker}-bulk-delete`)
    if (bulkDeleteId) {
      const bulkDelete = http.del(
        `${baseUrl}/api/v1/transactions/bulk`,
        JSON.stringify({ transactionIds: [bulkDeleteId] }),
        { headers, tags: { name: 'DELETE /api/v1/transactions/bulk' } }
      )
      checkNot5xx('DELETE /api/v1/transactions/bulk', bulkDelete)
    }
  })
}

const writeTransaction = (token) => {
  group('write transaction API', () => {
    const marker = `load-test-${Date.now()}-${__VU}-${__ITER}`
    const id = createTransaction(token, marker)
    if (!id) return

    const updateRes = http.put(
      `${baseUrl}/api/v1/transactions/${id}`,
      JSON.stringify({
        description: 'Updated disposable load-test transaction'
      }),
      {
        headers: authHeaders(token),
        tags: { name: 'PUT /api/v1/transactions/:id' }
      }
    )
    check(updateRes, {
      'transaction update is not 5xx': (response) => response.status < 500
    })

    deleteTransaction(token, id)
  })
}

const reportSafeApis = (token) => {
  group('report safe APIs', () => {
    const headers = authHeaders(token)

    const list = http.get(`${baseUrl}/api/v1/reports`, {
      headers,
      tags: { name: 'GET /api/v1/reports' }
    })
    checkNot5xx('GET /api/v1/reports', list)

    const settings = http.patch(
      `${baseUrl}/api/v1/reports/settings`,
      JSON.stringify({ isEnabled: true }),
      { headers, tags: { name: 'PATCH /api/v1/reports/settings' } }
    )
    checkNot5xx('PATCH /api/v1/reports/settings', settings)
  })
}

const emailOptionalApis = (token) => {
  if (!enableEmailScenarios) return

  group('email and OTP optional APIs', () => {
    const email = __ENV.TEST_EMAIL_FLOW_EMAIL || __ENV.TEST_USER_EMAIL
    const otp = __ENV.TEST_OTP
    const resetToken = __ENV.TEST_RESET_TOKEN
    const newEmail = __ENV.TEST_NEW_EMAIL

    const registerPayload = {
      email,
      password: __ENV.TEST_EMAIL_FLOW_PASSWORD || 'LoadTest123!',
      name: 'Load Test User'
    }

    const register = http.post(
      `${baseUrl}/api/v1/auth/register`,
      JSON.stringify(registerPayload),
      { headers: jsonHeaders, tags: { name: 'POST /api/v1/auth/register' } }
    )
    checkNot5xx('POST /api/v1/auth/register', register)

    const registerResend = http.post(
      `${baseUrl}/api/v1/auth/register/resend`,
      JSON.stringify({ email }),
      {
        headers: jsonHeaders,
        tags: { name: 'POST /api/v1/auth/register/resend' }
      }
    )
    checkNot5xx('POST /api/v1/auth/register/resend', registerResend)

    if (otp) {
      const registerVerify = http.post(
        `${baseUrl}/api/v1/auth/register/verify-otp`,
        JSON.stringify({ email, otp }),
        {
          headers: jsonHeaders,
          tags: { name: 'POST /api/v1/auth/register/verify-otp' }
        }
      )
      checkNot5xx('POST /api/v1/auth/register/verify-otp', registerVerify)
    }

    const forgot = http.post(
      `${baseUrl}/api/v1/auth/password/forgot`,
      JSON.stringify({ email }),
      {
        headers: jsonHeaders,
        tags: { name: 'POST /api/v1/auth/password/forgot' }
      }
    )
    checkNot5xx('POST /api/v1/auth/password/forgot', forgot)

    const forgotResend = http.post(
      `${baseUrl}/api/v1/auth/password/resend`,
      JSON.stringify({ email }),
      {
        headers: jsonHeaders,
        tags: { name: 'POST /api/v1/auth/password/resend' }
      }
    )
    checkNot5xx('POST /api/v1/auth/password/resend', forgotResend)

    if (otp) {
      const forgotVerify = http.post(
        `${baseUrl}/api/v1/auth/password/verify-otp`,
        JSON.stringify({ email, otp }),
        {
          headers: jsonHeaders,
          tags: { name: 'POST /api/v1/auth/password/verify-otp' }
        }
      )
      checkNot5xx('POST /api/v1/auth/password/verify-otp', forgotVerify)
    }

    if (resetToken) {
      const reset = http.post(
        `${baseUrl}/api/v1/auth/password/reset`,
        JSON.stringify({
          email,
          resetToken,
          newPassword: __ENV.TEST_EMAIL_FLOW_PASSWORD || 'LoadTest123!'
        }),
        {
          headers: jsonHeaders,
          tags: { name: 'POST /api/v1/auth/password/reset' }
        }
      )
      checkNot5xx('POST /api/v1/auth/password/reset', reset)
    }

    const headers = authHeaders(token)
    const changePasswordRequest = http.post(
      `${baseUrl}/api/v1/auth/password/change-request`,
      JSON.stringify({
        oldPassword: __ENV.TEST_USER_PASSWORD,
        newPassword: __ENV.TEST_EMAIL_FLOW_PASSWORD || 'LoadTest123!',
        confirmPassword: __ENV.TEST_EMAIL_FLOW_PASSWORD || 'LoadTest123!'
      }),
      {
        headers,
        tags: { name: 'POST /api/v1/auth/password/change-request' }
      }
    )
    checkNot5xx(
      'POST /api/v1/auth/password/change-request',
      changePasswordRequest
    )

    const changePasswordResend = http.post(
      `${baseUrl}/api/v1/auth/password/change-resend`,
      null,
      {
        headers,
        tags: { name: 'POST /api/v1/auth/password/change-resend' }
      }
    )
    checkNot5xx(
      'POST /api/v1/auth/password/change-resend',
      changePasswordResend
    )

    if (otp) {
      const changePasswordVerify = http.post(
        `${baseUrl}/api/v1/auth/password/change-verify`,
        JSON.stringify({ otp }),
        {
          headers,
          tags: { name: 'POST /api/v1/auth/password/change-verify' }
        }
      )
      checkNot5xx(
        'POST /api/v1/auth/password/change-verify',
        changePasswordVerify
      )
    }

    if (newEmail) {
      const changeEmailRequest = http.post(
        `${baseUrl}/api/v1/auth/email/change-request`,
        JSON.stringify({ newEmail }),
        {
          headers,
          tags: { name: 'POST /api/v1/auth/email/change-request' }
        }
      )
      checkNot5xx('POST /api/v1/auth/email/change-request', changeEmailRequest)

      const changeEmailResend = http.post(
        `${baseUrl}/api/v1/auth/email/change-resend`,
        null,
        {
          headers,
          tags: { name: 'POST /api/v1/auth/email/change-resend' }
        }
      )
      checkNot5xx('POST /api/v1/auth/email/change-resend', changeEmailResend)

      if (otp) {
        const changeEmailVerify = http.post(
          `${baseUrl}/api/v1/auth/email/change-verify`,
          JSON.stringify({
            oldEmailOtp: __ENV.TEST_OLD_EMAIL_OTP || otp,
            newEmailOtp: __ENV.TEST_NEW_EMAIL_OTP || otp
          }),
          {
            headers,
            tags: { name: 'POST /api/v1/auth/email/change-verify' }
          }
        )
        checkNot5xx('POST /api/v1/auth/email/change-verify', changeEmailVerify)
      }
    }
  })
}

const providerOptionalApis = (token) => {
  if (!enableProviderScenarios) return

  group('provider optional APIs', () => {
    const headers = authHeaders(token)

    const from = __ENV.REPORT_FROM || new Date().toISOString().slice(0, 10)
    const to = __ENV.REPORT_TO || new Date().toISOString().slice(0, 10)
    const generate = http.get(
      `${baseUrl}/api/v1/reports/generate?from=${from}&to=${to}`,
      { headers, tags: { name: 'GET /api/v1/reports/generate' } }
    )
    checkNot5xx('GET /api/v1/reports/generate', generate)

    if (__ENV.TEST_REPORT_ID) {
      const resend = http.post(
        `${baseUrl}/api/v1/reports/resend/${__ENV.TEST_REPORT_ID}`,
        null,
        { headers, tags: { name: 'POST /api/v1/reports/resend/:reportId' } }
      )
      checkNot5xx('POST /api/v1/reports/resend/:reportId', resend)
    }

    if (receiptFixture) {
      const scan = http.post(
        `${baseUrl}/api/v1/transactions/scan-receipt`,
        {
          receipt: http.file(
            receiptFixture,
            __ENV.RECEIPT_FIXTURE_NAME || 'receipt.png',
            __ENV.RECEIPT_FIXTURE_MIME || 'image/png'
          )
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          tags: { name: 'POST /api/v1/transactions/scan-receipt' }
        }
      )
      checkNot5xx('POST /api/v1/transactions/scan-receipt', scan)

      const jobId = parseJson(scan)?.data?.jobId
      if (jobId) {
        const status = http.get(
          `${baseUrl}/api/v1/transactions/scan-receipt/${jobId}`,
          {
            headers,
            tags: { name: 'GET /api/v1/transactions/scan-receipt/:jobId' }
          }
        )
        checkNot5xx('GET /api/v1/transactions/scan-receipt/:jobId', status)
      }
    }
  })
}

const allSafeApis = (token) => {
  readApis(token)
  transactionFullApis(token)
  reportSafeApis(token)
}

export function setup() {
  if (scenario === 'smoke-public') return { token: null }
  return login()
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

  if (scenario === 'auth-core') {
    authCoreApis()
  }

  if (scenario === 'read' || scenario === 'all') {
    readApis(token)
  }

  if (scenario === 'write' || scenario === 'all') {
    writeTransaction(token)
  }

  if (scenario === 'transaction-full') {
    transactionFullApis(token)
  }

  if (scenario === 'analytics-full') {
    analyticsApis(token)
  }

  if (scenario === 'report-safe') {
    reportSafeApis(token)
  }

  if (scenario === 'all-safe') {
    allSafeApis(token)
  }

  if (scenario === 'email-optional' || scenario === 'coverage-optional') {
    emailOptionalApis(token)
  }

  if (scenario === 'password-mutation-optional') {
    userPasswordMutationOptionalApi(token)
  }

  if (scenario === 'provider-optional' || scenario === 'coverage-optional') {
    providerOptionalApis(token)
  }

  if (scenario === 'coverage-all') {
    allSafeApis(token)
    authCoreApis()
    emailOptionalApis(token)
    userPasswordMutationOptionalApi(token)
    providerOptionalApis(token)
  }

  sleep(1)
}
