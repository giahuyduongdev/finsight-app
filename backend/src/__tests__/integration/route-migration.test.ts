import express from 'express'
import request from 'supertest'
import { HTTPSTATUS } from '../../config/http.config'
import reportRoutes from '../../routes/v1/report.routes'
import userRoutes from '../../routes/v1/user.routes'

jest.mock('../../container', () => ({
  container: {
    getTransactionService: () => ({}),
    getReportService: () => ({
      findByUserId: jest.fn().mockResolvedValue({
        data: [],
        pagination: {
          pageNumber: 1,
          pageSize: 10,
          totalCount: 0,
          totalPages: 0
        }
      }),
      updateSettings: jest.fn().mockResolvedValue({
        toObject: () => ({
          _id: '507f1f77bcf86cd799439011',
          userId: '507f1f77bcf86cd799439012',
          frequency: 'MONTHLY',
          isEnabled: true,
          lastSentDate: null,
          nextReportDate: null
        })
      })
    }),
    getUserService: () => ({
      findById: jest.fn().mockResolvedValue({
        toObject: () => ({
          _id: '507f1f77bcf86cd799439012',
          email: 'user@example.com',
          name: 'Test User',
          role: 'USER',
          timezone: 'UTC',
          preferredCurrency: 'USD'
        })
      }),
      update: jest.fn().mockResolvedValue({
        toObject: () => ({
          _id: '507f1f77bcf86cd799439012',
          email: 'user@example.com',
          name: 'Updated User',
          role: 'USER',
          timezone: 'UTC',
          preferredCurrency: 'USD'
        })
      })
    }),
    getAnalyticsService: () => ({})
  }
}))

describe('Route migration integration', () => {
  const createApp = () => {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      req.user = {
        _id: '507f1f77bcf86cd799439012',
        email: 'user@example.com',
        name: 'Test User',
        timezone: 'UTC',
        preferredCurrency: 'USD',
        role: 'USER'
      } as Express.User
      next()
    })
    app.use('/api/v1/reports', reportRoutes)
    app.use('/api/v1/users', userRoutes)
    return app
  }

  it('should expose new REST-compliant report routes', async () => {
    const app = createApp()
    const listResponse = await request(app).get('/api/v1/reports')
    const settingsResponse = await request(app)
      .patch('/api/v1/reports/settings')
      .send({ isEnabled: true })

    expect(listResponse.status).toBe(HTTPSTATUS.OK)
    expect(listResponse.body).toMatchObject({
      data: [],
      meta: {
        pagination: {
          pageNumber: 1,
          pageSize: 10,
          totalCount: 0,
          totalPages: 0
        }
      }
    })
    expect(listResponse.headers.deprecation).toBeUndefined()

    expect(settingsResponse.status).toBe(HTTPSTATUS.OK)
    expect(settingsResponse.body).toMatchObject({
      data: {
        _id: '507f1f77bcf86cd799439011',
        isEnabled: true
      },
      meta: {
        message: 'Report settings retrieved successfully'
      }
    })
    expect(settingsResponse.headers.deprecation).toBeUndefined()
  })

  it('should not expose legacy report routes', async () => {
    const app = createApp()
    const listResponse = await request(app).get('/api/report/all')
    const settingsResponse = await request(app)
      .put('/api/report/update-setting')
      .send({ isEnabled: true })

    expect(listResponse.status).toBe(HTTPSTATUS.NOT_FOUND)
    expect(settingsResponse.status).toBe(HTTPSTATUS.NOT_FOUND)
  })

  it('should expose new REST-compliant user routes', async () => {
    const app = createApp()
    const currentUserResponse = await request(app).get('/api/v1/users/me')
    const updateUserResponse = await request(app)
      .patch('/api/v1/users/me')
      .field('name', 'Updated User')

    expect(currentUserResponse.status).toBe(HTTPSTATUS.OK)
    expect(currentUserResponse.body).toMatchObject({
      data: {
        email: 'user@example.com'
      },
      meta: {
        message: 'User fetched successfully'
      }
    })
    expect(currentUserResponse.headers.deprecation).toBeUndefined()

    expect(updateUserResponse.status).toBe(HTTPSTATUS.OK)
    expect(updateUserResponse.body).toMatchObject({
      data: {
        name: 'Updated User'
      },
      meta: {
        message: 'User profile updated successfully'
      }
    })
    expect(updateUserResponse.headers.deprecation).toBeUndefined()
  })

  it('should not expose legacy user routes', async () => {
    const app = createApp()
    const currentUserResponse = await request(app).get('/api/user/current-user')
    const updateUserResponse = await request(app)
      .put('/api/user/update-user')
      .field('name', 'Updated User')

    expect(currentUserResponse.status).toBe(HTTPSTATUS.NOT_FOUND)
    expect(updateUserResponse.status).toBe(HTTPSTATUS.NOT_FOUND)
  })
})
