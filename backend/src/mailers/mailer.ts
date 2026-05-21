import { Env } from '../config/env.config'
import { resend } from '../config/resend.config'
import { resendCircuitBreaker } from '../utils/circuitBreaker.util'

type Params = {
  to: string | string[]
  subject: string
  text: string
  html: string
  from?: string
}

const mailer_sender = `Finsight <${Env.RESEND_MAILER_SENDER}>`

export const sendEmail = async ({
  to,
  from = mailer_sender,
  subject,
  text,
  html
}: Params) => {
  return await resendCircuitBreaker.execute(
    () =>
      resend.emails.send({
        from,
        to: Array.isArray(to) ? to : [to],
        text,
        subject,
        html
      }),
    'Resend Email'
  )
}
