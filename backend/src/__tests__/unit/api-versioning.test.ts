import express, { Request, Response } from 'express'
import request from 'supertest'
import v1Routes from '../../routes/v1'

jest.mock('../../config/passport.config', () => ({
  passportAuthenticateJwt: (req: Request, res: Response, next: () => void) => {
    if (req.headers.authorization === 'Bearer test-token') return next()
    return res.status(401).json({ error: { code: 'UNAUTHORIZED' } })
  }
}))

jest.mock('../../routes/v1/auth.routes', () => ({
  __esModule: true,
  default: express.Router()
}))

jest.mock('../../routes/v1/transaction.routes', () => ({
  __esModule: true,
  default: express.Router()
}))

jest.mock('../../routes/v1/analytics.routes', () => ({
  __esModule: true,
  default: express.Router()
}))

jest.mock('../../config/cloudinary.config', () => ({
  upload: {
    single: () => (_req: Request, _res: Response, next: () => void) => next()
  },
  uploadMemory: {
    single: () => (_req: Request, _res: Response, next: () => void) => next()
  }
}))

jest.mock('../../controllers/report.controller', () => ({
  getAllReportsController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'reports' } }),
  updateReportSettingController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'report-settings' } }),
  generateReportController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'generate-report' } }),
  resendReportController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'resend-report' } })
}))

jest.mock('../../controllers/user.controller', () => ({
  getCurrentUserController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'users-me' } }),
  updateUserController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'update-user' } }),
  changeUserPasswordController: (_req: Request, res: Response) =>
    res.status(200).json({ data: { route: 'change-password' } })
}))

describe('API versioning', () => {
  const app = express()

  beforeAll(() => {
    app.use(express.json())
    app.use('/api/v1', v1Routes)
  })

  it('serves REST routes through /api/v1 prefix', async () => {
    const reportsResponse = await request(app)
      .get('/api/v1/reports')
      .set('Authorization', 'Bearer test-token')
    const settingsResponse = await request(app)
      .patch('/api/v1/reports/settings')
      .set('Authorization', 'Bearer test-token')
      .send({ isEnabled: true })
    const currentUserResponse = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer test-token')
    const updateUserResponse = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Jane' })

    expect(reportsResponse.body).toEqual({ data: { route: 'reports' } })
    expect(settingsResponse.body).toEqual({
      data: { route: 'report-settings' }
    })
    expect(currentUserResponse.body).toEqual({ data: { route: 'users-me' } })
    expect(updateUserResponse.body).toEqual({ data: { route: 'update-user' } })
  })

  it('enforces authentication on protected v1 routes', async () => {
    const unauthenticatedReports = await request(app).get('/api/v1/reports')
    const unauthenticatedUser = await request(app).get('/api/v1/users/me')
    const authenticatedUser = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer test-token')

    expect(unauthenticatedReports.status).toBe(401)
    expect(unauthenticatedUser.status).toBe(401)
    expect(authenticatedUser.status).toBe(200)
    expect(authenticatedUser.body).toEqual({ data: { route: 'users-me' } })
  })

  it('does not expose deleted legacy routes', async () => {
    const reportResponse = await request(app).get('/api/report/all')
    const reportSettingsResponse = await request(app)
      .put('/api/report/update-setting')
      .send({ isEnabled: true })
    const userResponse = await request(app).get('/api/user/current-user')
    const updateUserResponse = await request(app)
      .put('/api/user/update-user')
      .send({ name: 'Jane' })

    expect(reportResponse.status).toBe(404)
    expect(reportSettingsResponse.status).toBe(404)
    expect(userResponse.status).toBe(404)
    expect(updateUserResponse.status).toBe(404)
  })

  it('does not expose non-versioned REST route duplicates', async () => {
    const reportsResponse = await request(app).get('/api/reports')
    const usersResponse = await request(app).get('/api/users/me')

    expect(reportsResponse.status).toBe(404)
    expect(usersResponse.status).toBe(404)
  })
})
