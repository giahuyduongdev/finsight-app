import express, { Request, Response } from 'express'
import request from 'supertest'
import reportRoutes from '../../routes/v1/report.routes'
import userRoutes from '../../routes/v1/user.routes'

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

describe('API versioning', () => {
  const app = express()

  beforeAll(() => {
    app.use(express.json())
    app.use('/api/v1/reports', reportRoutes)
    app.use('/api/v1/users', userRoutes)
  })

  it('serves REST routes through /api/v1 prefix', async () => {
    const reportsResponse = await request(app).get('/api/v1/reports')
    const settingsResponse = await request(app)
      .patch('/api/v1/reports/settings')
      .send({ isEnabled: true })
    const currentUserResponse = await request(app).get('/api/v1/users/me')
    const updateUserResponse = await request(app)
      .patch('/api/v1/users/me')
      .send({ name: 'Jane' })

    expect(reportsResponse.body).toEqual({ route: 'reports' })
    expect(settingsResponse.body).toEqual({ route: 'report-settings' })
    expect(currentUserResponse.body).toEqual({ route: 'users-me' })
    expect(updateUserResponse.body).toEqual({ route: 'update-user' })
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
