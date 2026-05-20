import express, { Request, Response } from 'express'
import request from 'supertest'
import reportRoutes from '../../routes/v1/report.routes'
import userRoutes from '../../routes/v1/user.routes'

jest.mock('../../middlewares/validate.middleware', () => ({
  validate: () => (_req: Request, _res: Response, next: () => void) => next()
}))

jest.mock('../../config/cloudinary.config', () => ({
  upload: {
    single: () => (_req: Request, _res: Response, next: () => void) => next()
  }
}))

jest.mock('../../controllers/report.controller', () => ({
  getAllReportsController: (_req: Request, res: Response) =>
    res.status(200).json({ route: 'reports' }),
  updateReportSettingController: (_req: Request, res: Response) =>
    res.status(200).json({ route: 'report-settings' }),
  generateReportController: (_req: Request, res: Response) =>
    res.status(200).json({ route: 'generate-report' }),
  resendReportController: (_req: Request, res: Response) =>
    res.status(200).json({ route: 'resend-report' })
}))

jest.mock('../../controllers/user.controller', () => ({
  getCurrentUserController: (_req: Request, res: Response) =>
    res.status(200).json({ route: 'users-me' }),
  updateUserController: (_req: Request, res: Response) =>
    res.status(200).json({ route: 'update-user' }),
  changeUserPasswordController: (_req: Request, res: Response) =>
    res.status(200).json({ route: 'change-password' })
}))

describe('REST route migration', () => {
  const createApp = () => {
    const app = express()
    app.use(express.json())
    app.use('/api/v1/reports', reportRoutes)
    app.use('/api/v1/users', userRoutes)
    return app
  }

  it('should expose new REST-compliant report routes without deprecation headers', async () => {
    const app = createApp()

    const listResponse = await request(app).get('/api/v1/reports')
    const settingsResponse = await request(app)
      .patch('/api/v1/reports/settings')
      .send({ isEnabled: true })

    expect(listResponse.status).toBe(200)
    expect(listResponse.body).toEqual({ route: 'reports' })
    expect(listResponse.headers.deprecation).toBeUndefined()

    expect(settingsResponse.status).toBe(200)
    expect(settingsResponse.body).toEqual({ route: 'report-settings' })
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

    const currentUserResponse = await request(app).get('/api/v1/users/me')
    const updateUserResponse = await request(app)
      .patch('/api/v1/users/me')
      .send({ name: 'Jane' })

    expect(currentUserResponse.status).toBe(200)
    expect(currentUserResponse.body).toEqual({ route: 'users-me' })
    expect(currentUserResponse.headers.deprecation).toBeUndefined()

    expect(updateUserResponse.status).toBe(200)
    expect(updateUserResponse.body).toEqual({ route: 'update-user' })
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
