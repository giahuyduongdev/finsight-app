import { Request, Response, NextFunction } from 'express'
import { AnyZodObject, ZodEffects, ZodTypeAny } from 'zod'

type RequestSource = 'body' | 'params' | 'query'

export const validate = (
  schema: AnyZodObject | ZodEffects<AnyZodObject> | ZodTypeAny,
  source: RequestSource = 'body'
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Extract data from the specified source
      const data = req[source]

      // For params validation with primitive schemas (like ZodString),
      // we need to extract the specific param value
      let dataToValidate = data
      if (source === 'params' && typeof data === 'object' && data !== null) {
        // If schema is for a single param (like :id), extract the 'id' value
        const paramKeys = Object.keys(data)
        if (paramKeys.length === 1) {
          dataToValidate = data[paramKeys[0]]
        }
      }

      // Validate data against schema using parseAsync for async refinement support
      const validated = await schema.parseAsync(dataToValidate)

      // Attach validated data to request object
      if (source === 'params' && typeof data === 'object' && data !== null) {
        const paramKeys = Object.keys(data)
        if (paramKeys.length === 1) {
          // For single param validation, put the validated value back
          req[source] = { ...data, [paramKeys[0]]: validated }
        } else {
          req[source] = validated
        }
      } else {
        req[source] = validated
      }

      next()
    } catch (error) {
      // Pass ZodError to error handler middleware
      next(error)
    }
  }
}
