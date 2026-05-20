import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Loader, ArrowLeft, MailCheck, RefreshCw } from 'lucide-react'
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
  useRegisterOTPMutation,
  useVerifyRegisterOTPMutation,
  useResendRegisterOTPMutation
} from '@/features/auth/authAPI'
import { getApiBaseUrl } from '@/app/api-client'

// ─── Constants ────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN = 60 // giây — phải khớp với REDIS_TTL.RESEND bên BE

// ─── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .regex(/^[A-Z]/, 'Password must start with an uppercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      'Password must contain at least one special character'
    ),
  timezone: z.string().optional()
})

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d+$/, 'OTP must contain only numbers')
})

type RegisterValues = z.infer<typeof registerSchema>
type OtpValues = z.infer<typeof otpSchema>

// ─── OAuth helper ─────────────────────────────────────────────────────────────

const handleOAuth = (provider: 'github' | 'google') => {
  const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const backendUrl = getApiBaseUrl() || 'http://localhost:8000/api/v1'
  window.location.href = `${backendUrl}/auth/oauth/${provider}?tz=${encodeURIComponent(currentTz)}`
}

// ─── OTP Input Component ──────────────────────────────────────────────────────

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const OtpInput = ({ value, onChange, disabled }: OtpInputProps) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, char: string) => {
    // Chỉ lấy ký tự cuối (trường hợp paste sẽ xử lý riêng)
    const digit = char.replace(/\D/g, '').slice(-1)
    const arr = value.padEnd(6, ' ').split('')
    arr[index] = digit || ' '
    const next = arr.join('').trimEnd()
    onChange(next)

    // Focus ô tiếp theo
    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      const arr = value.padEnd(6, ' ').split('')
      if (arr[index]?.trim()) {
        // Xóa ký tự hiện tại
        arr[index] = ' '
        onChange(arr.join('').trimEnd())
      } else if (index > 0) {
        // Focus về ô trước nếu ô hiện tại trống
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
    // Focus ô cuối cùng được điền
    const focusIndex = Math.min(pasted.length, 5)
    inputsRef.current[focusIndex]?.focus()
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
          aria-label={`OTP digit ${i + 1} of 6`}
          className="w-11 h-12 text-center text-lg font-semibold rounded-lg border border-input bg-background
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all"
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
    if (!isRunning) return
    if (seconds <= 0) {
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

// ─── Main Component ───────────────────────────────────────────────────────────

type Step = 'form' | 'verify_otp'

const SignUpForm = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')
  const [pendingEmail, setPendingEmail] = useState('')

  const [registerOTP, { isLoading: isRegistering }] = useRegisterOTPMutation()
  const [verifyOTP, { isLoading: isVerifying }] = useVerifyRegisterOTPMutation()
  const [resendOTP, { isLoading: isResending }] = useResendRegisterOTPMutation()

  const { seconds, canResend, reset: resetCountdown } = useResendCountdown()

  // ── Step 1: Register form ──────────────────────────────────────────────────

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  })

  const onRegisterSubmit = async (values: RegisterValues) => {
    try {
      await registerOTP(values).unwrap()
      setPendingEmail(values.email)
      setStep('verify_otp')
      toast.success('OTP sent! Check your email.')
    } catch (error: unknown) {
      const err = error as {
        data?: {
          errorCode?: string
          data?: { canResend?: boolean; remainingTime?: number }
          message?: string
        }
      }
      const errorCode = err.data?.errorCode
      const extra = err.data?.data

      // Email đang chờ verify từ lần đăng ký trước
      if (errorCode === 'AUTH_EMAIL_PENDING_VERIFICATION') {
        setPendingEmail(values.email)
        setStep('verify_otp')
        if (extra?.canResend === false && extra?.remainingTime) {
          resetCountdown(extra.remainingTime)
        }
        toast.info('This email already has a pending OTP. Please verify it.')
        return
      }

      toast.error(err.data?.message || 'Failed to send OTP')
    }
  }

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────────

  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' }
  })

  const onOtpSubmit = async (values: OtpValues) => {
    try {
      await verifyOTP({ email: pendingEmail, otp: values.otp }).unwrap()
      toast.success('Account created successfully! Please log in.')
      navigate(AUTH_ROUTES.SIGN_IN)
    } catch (error: unknown) {
      const err = error as { data?: { errorCode?: string; message?: string } }
      const errorCode = err.data?.errorCode

      if (errorCode === 'AUTH_OTP_EXPIRED') {
        toast.error('OTP has expired. Please request a new one.')
        otpForm.reset()
        return
      }

      // AUTH_OTP_INVALID — message đã có số lần còn lại từ BE
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
      // Nếu BE trả về remainingTime, sync lại countdown
      if (err.data?.data?.remainingTime) {
        resetCountdown(err.data.data.remainingTime)
      }
      toast.error(err.data?.message || 'Failed to resend OTP')
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  // Step 2: OTP verification
  if (step === 'verify_otp') {
    return (
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-1">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-muted-foreground text-balance">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-foreground">{pendingEmail}</span>
          </p>
        </div>

        {/* OTP Form */}
        <Form {...otpForm}>
          <form
            onSubmit={otpForm.handleSubmit(onOtpSubmit)}
            className="flex flex-col gap-6"
          >
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
              Verify account
            </Button>
          </form>
        </Form>

        {/* Resend + Back */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {canResend ? (
              <Button
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
              setStep('form')
              otpForm.reset()
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to sign up
          </button>
        </div>
      </div>
    )
  }

  // Step 1: Register form
  return (
    <Form {...registerForm}>
      <form
        onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Sign up to Finsight.</h1>
          <p className="text-balance text-sm text-muted-foreground">
            Fill information below to sign up
          </p>
        </div>

        <div className="grid gap-4">
          <FormField
            control={registerForm.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="!font-normal">Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Hill" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={registerForm.control}
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

          <FormField
            control={registerForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="!font-normal">Password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button disabled={isRegistering} type="submit" className="w-full">
            {isRegistering && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            Sign up
          </Button>

          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-white dark:bg-zinc-950 px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth('github')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="mr-2 h-4 w-4"
              >
                <path
                  d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                  fill="currentColor"
                />
              </svg>
              Sign up with GitHub
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth('google')}
            >
              <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign up with Google
            </Button>
          </div>
        </div>

        <div className="text-center text-sm">
          Already have an account?{' '}
          <Link
            to={AUTH_ROUTES.SIGN_IN}
            className="underline underline-offset-4"
          >
            Sign in
          </Link>
        </div>
      </form>
    </Form>
  )
}

export default SignUpForm
