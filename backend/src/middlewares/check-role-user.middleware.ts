// middlewares/check-role.middleware.ts
import { Request, Response, NextFunction } from 'express'
import { ForbiddenException } from '../utils/errors/index'

export const checkRoleUser = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role

    if (!userRole || !roles.includes(userRole)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource'
      )
    }

    next()
  }
}
