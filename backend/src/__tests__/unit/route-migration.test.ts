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

jest.mock('../../middlewares/validate.middleware', () => ({
  validate: () => (_req: Request, _res: Response, next: () => void) => next()
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

describe('REST route migration', () => {
  const createApp = () => {
    const app = express()
    app.use(express.json())
    app.use('/api/v1', v1Routes)
    return app
  }

  it('should expose new REST-compliant report routes without deprecation headers', async () => {
    const app = createApp()

    const listResponse = await request(app)
      .get('/api/v1/reports')
      .set('Authorization', 'Bearer test-token')
    const settingsResponse = await request(app)
      .patch('/api/v1/reports/settings')
      .set('Authorization', 'Bearer test-token')
      .send({ isEnabled: true })

    expect(listResponse.status).toBe(200)
    expect(listResponse.body).toEqual({ data: { route: 'reports' } })
    expect(listResponse.headers.deprecation).toBeUndefined()

    expect(settingsResponse.status).toBe(200)
    expect(settingsResponse.body).toEqual({
      data: { route: 'report-settings' }
    })
    expect(settingsResponse.headers.deprecation).toBeUndefined()
  })

  it('should not expose legacy report routes', async () => {
    const app = createApp()

    const listResponse = await request(app).get('/api/report/all')
    const settingsResponse = await request(app)
      .put('/api/report/update-setting')
      .send({ isEnabled: true })

    expect(listResponse.status).toBe(404)
    expect(settingsResponse.status).toBe(404)
  })

  it('should expose new REST-compliant user routes without deprecation headers', async () => {
    const app = createApp()

    const unauthenticatedCurrentUserResponse =
      await request(app).get('/api/v1/users/me')
    const unauthenticatedUpdateUserResponse = await request(app)
      .patch('/api/v1/users/me')
      .send({ name: 'Jane' })
    const currentUserResponse = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer test-token')
    const updateUserResponse = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Jane' })

    expect(unauthenticatedCurrentUserResponse.status).toBe(401)
    expect(unauthenticatedUpdateUserResponse.status).toBe(401)
    expect(currentUserResponse.status).toBe(200)
    expect(currentUserResponse.body).toEqual({ data: { route: 'users-me' } })
    expect(currentUserResponse.headers.deprecation).toBeUndefined()

    expect(updateUserResponse.status).toBe(200)
    expect(updateUserResponse.body).toEqual({ data: { route: 'update-user' } })
    expect(updateUserResponse.headers.deprecation).toBeUndefined()
  })

  it('should not expose legacy user routes', async () => {
    const app = createApp()

    const currentUserResponse = await request(app).get('/api/user/current-user')
    const updateUserResponse = await request(app)
      .put('/api/user/update-user')
      .send({ name: 'Jane' })

    expect(currentUserResponse.status).toBe(404)
    expect(updateUserResponse.status).toBe(404)
  })
})
