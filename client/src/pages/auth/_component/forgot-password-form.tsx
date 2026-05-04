import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Loader, ArrowLeft, MailCheck, RefreshCw, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { AUTH_ROUTES } from '@/routes/common/routePath'
import {
  useForgotPasswordMutation,
  useVerifyForgotOTPMutation,
  useResendForgotOTPMutation,
  useResetPasswordMutation
} from '@/features/auth/authAPI'

// ─── Constants ────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN = 60 // giây — khớp với REDIS_TTL.FORGOT_RESEND bên BE

// ─── Schemas ──────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().email('Invalid email address')
})

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d+$/, 'OTP must contain only numbers')
})

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(6, 'Password must be at least 6 characters')
      .regex(/^[A-Z]/, 'Password must start with an uppercase letter')
      .regex(/\d/, 'Password must contain at least one number')
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        'Password must contain at least one special character'
      ),
    confirmPassword: z.string()
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

type EmailValues = z.infer<typeof emailSchema>
type OtpValues = z.infer<typeof otpSchema>
type ResetValues = z.infer<typeof resetSchema>

// ─── OTP Input Component ──────────────────────────────────────────────────────

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const OtpInput = ({ value, onChange, disabled }: OtpInputProps) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1)
    const arr = value.padEnd(6, ' ').split('')
    arr[index] = digit || ' '
    const next = arr.join('').trimEnd()
    onChange(next)
    if (digit && index < 5) inputsRef.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      const arr = value.padEnd(6, ' ').split('')
      if (arr[index]?.trim()) {
        arr[index] = ' '
        onChange(arr.join('').trimEnd())
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft' && index > 0)
      inputsRef.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5)
      inputsRef.current[index + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6)
    onChange(pasted)
    inputsRef.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-11 h-12 text-center text-lg font-semibold rounded-lg border border-input bg-background
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        />
      ))}
    </div>
  )
}

// ─── Resend Countdown Hook ────────────────────────────────────────────────────

const useResendCountdown = (initialSeconds = RESEND_COOLDOWN) => {
  const [seconds, setSeconds] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(true)

  useEffect(() => {
    if (!isRunning || seconds <= 0) {
      setIsRunning(false)
      return
    }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds, isRunning])

  const reset = (remainingFromServer?: number) => {
    setSeconds(remainingFromServer ?? RESEND_COOLDOWN)
    setIsRunning(true)
  }

  return { seconds, canResend: !isRunning, reset }
}

// PasswordInput is now imported from @/components/ui/password-input

// ─── Main Component ───────────────────────────────────────────────────────────

type Step = 'enter_email' | 'verify_otp' | 'reset_password'

const ForgotPasswordForm = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('enter_email')
  const [pendingEmail, setPendingEmail] = useState('')
  const [resetToken, setResetToken] = useState('')

  const [forgotPassword, { isLoading: isSendingOTP }] =
    useForgotPasswordMutation()
  const [verifyOTP, { isLoading: isVerifying }] = useVerifyForgotOTPMutation()
  const [resendOTP, { isLoading: isResending }] = useResendForgotOTPMutation()
  const [resetPassword, { isLoading: isResetting }] = useResetPasswordMutation()

  const { seconds, canResend, reset: resetCountdown } = useResendCountdown()

  // ── Step 1: Enter email ────────────────────────────────────────────────────

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' }
  })

  const onEmailSubmit = async (values: EmailValues) => {
    try {
      await forgotPassword(values).unwrap()
      setPendingEmail(values.email)
      setStep('verify_otp')
      // BE luôn trả 200 dù email không tồn tại (anti-enumeration)
      toast.success(
        'If this email is registered, you will receive an OTP shortly.'
      )
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Something went wrong')
    }
  }

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────────

  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' }
  })

  const onOtpSubmit = async (values: OtpValues) => {
    try {
      const result = await verifyOTP({
        email: pendingEmail,
        otp: values.otp
      }).unwrap()
      setResetToken(result.resetToken)
      setStep('reset_password')
    } catch (error: unknown) {
      const err = error as {
        data?: {
          errorCode?: string
          data?: { remainingAttempts?: number }
          message?: string
        }
      }
      const errorCode = err.data?.errorCode

      if (errorCode === 'AUTH_OTP_EXPIRED') {
        toast.error('OTP has expired. Please request a new one.')
        otpForm.reset()
        return
      }

      if (errorCode === 'AUTH_OTP_TOO_MANY_REQUESTS') {
        toast.error('Too many failed attempts. Please request a new OTP.')
        otpForm.reset()
        resetCountdown()
        return
      }

      // AUTH_OTP_INVALID — message từ BE đã có số lần còn lại
      toast.error(err.data?.message || 'Invalid OTP')
      otpForm.reset()
    }
  }

  const handleResend = async () => {
    try {
      await resendOTP({ email: pendingEmail }).unwrap()
      otpForm.reset()
      resetCountdown()
      toast.success('New OTP sent to your email')
    } catch (error: unknown) {
      const err = error as {
        data?: { data?: { remainingTime?: number }; message?: string }
      }
      if (err.data?.data?.remainingTime) {
        resetCountdown(err.data.data.remainingTime)
      }
      toast.error(err.data?.message || 'Failed to resend OTP')
    }
  }

  // ── Step 3: Reset password ─────────────────────────────────────────────────

  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' }
  })

  const onResetSubmit = async (values: ResetValues) => {
    try {
      await resetPassword({
        email: pendingEmail,
        resetToken,
        newPassword: values.newPassword
      }).unwrap()
      toast.success('Password reset successfully! Please log in.')
      navigate(AUTH_ROUTES.SIGN_IN)
    } catch (error: unknown) {
      const err = error as { data?: { errorCode?: string; message?: string } }
      const errorCode = err.data?.errorCode

      if (errorCode === 'AUTH_PASSWORD_MUST_BE_DIFFERENT') {
        resetForm.setError('newPassword', {
          message: 'New password must be different from the old one'
        })
        return
      }

      if (errorCode === 'AUTH_OTP_EXPIRED') {
        toast.error('Reset session expired. Please start over.')
        setStep('enter_email')
        emailForm.reset()
        otpForm.reset()
        resetForm.reset()
        return
      }

      toast.error(err.data?.message || 'Failed to reset password')
    }
  }

  // ─── Step indicator ────────────────────────────────────────────────────────

  const steps: Step[] = ['enter_email', 'verify_otp', 'reset_password']
  const currentIndex = steps.indexOf(step)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                i <= currentIndex ? 'bg-primary w-4' : 'bg-muted'
              }`}
            />
          </div>
        ))}
      </div>

      {/* ── Step 1: Enter email ──────────────────────────────────────────── */}
      {step === 'enter_email' && (
        <Form {...emailForm}>
          <form
            onSubmit={emailForm.handleSubmit(onEmailSubmit)}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold">Forgot password?</h1>
              <p className="text-sm text-muted-foreground text-balance">
                Enter your email and we'll send you a verification code
              </p>
            </div>

            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="!font-normal">Email</FormLabel>
                  <FormControl>
                    <Input placeholder="m@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSendingOTP}>
              {isSendingOTP && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Send OTP
            </Button>

            <div className="text-center">
              <Link
                to={AUTH_ROUTES.SIGN_IN}
                className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to sign in
              </Link>
            </div>
          </form>
        </Form>
      )}

      {/* ── Step 2: Verify OTP ───────────────────────────────────────────── */}
      {step === 'verify_otp' && (
        <Form {...otpForm}>
          <form
            onSubmit={otpForm.handleSubmit(onOtpSubmit)}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-1">
                <MailCheck className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-sm text-muted-foreground text-balance">
                We sent a 6-digit code to{' '}
                <span className="font-medium text-foreground">
                  {pendingEmail}
                </span>
              </p>
            </div>

            <FormField
              control={otpForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <OtpInput
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isVerifying}
                    />
                  </FormControl>
                  <FormMessage className="text-center" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isVerifying || otpForm.watch('otp').length < 6}
            >
              {isVerifying && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Verify OTP
            </Button>

            {/* Resend + Back */}
            <div className="flex flex-col items-center gap-3">
              <div className="text-sm text-muted-foreground">
                {canResend ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResend}
                    disabled={isResending}
                    className="gap-2 h-auto py-1"
                  >
                    {isResending ? (
                      <Loader className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Resend OTP
                  </Button>
                ) : (
                  <span>
                    Resend in{' '}
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                      {String(seconds % 60).padStart(2, '0')}
                    </span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('enter_email')
                  otpForm.reset()
                }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            </div>
          </form>
        </Form>
      )}

      {/* ── Step 3: Reset password ───────────────────────────────────────── */}
      {step === 'reset_password' && (
        <Form {...resetForm}>
          <form
            onSubmit={resetForm.handleSubmit(onResetSubmit)}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-1">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Set new password</h1>
              <p className="text-sm text-muted-foreground text-balance">
                Choose a strong password for your account
              </p>
            </div>

            <div className="grid gap-4">
              <FormField
                control={resetForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="!font-normal">New password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resetForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="!font-normal">
                      Confirm password
                    </FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isResetting}>
              {isResetting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Reset password
            </Button>
          </form>
        </Form>
      )}
    </div>
  )
}

export default ForgotPasswordForm
