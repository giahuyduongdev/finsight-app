import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader, KeyRound, MailCheck, RefreshCw, ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { PasswordInput } from '@/components/ui/password-input'
import {
  useChangePasswordRequestMutation,
  useVerifyChangePasswordOTPMutation,
  useResendChangePasswordOTPMutation
} from '@/features/auth/authAPI'
import { useRef, useEffect } from 'react'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const changePasswordRequestSchema = z
  .object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: z
      .string()
      .min(6, 'Password must be at least 6 characters')
      .regex(/^[A-Z]/, 'Password must start with an uppercase letter')
      .regex(/\d/, 'Password must contain at least one number')
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        'Password must contain at least one special character'
      ),
    confirmPassword: z.string().min(1, 'Confirm password is required')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password don't match",
    path: ['confirmPassword']
  })

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d+$/, 'OTP must contain only numbers')
})

type ChangePasswordRequestValues = z.infer<typeof changePasswordRequestSchema>
type OtpValues = z.infer<typeof otpSchema>

// ─── OTP Input Component (Shared internal) ────────────────────────────────────

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

    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'otp'>('form')

  const [requestChange, { isLoading: isRequesting }] =
    useChangePasswordRequestMutation()
  const [verifyOTP, { isLoading: isVerifying }] =
    useVerifyChangePasswordOTPMutation()
  const [resendOTP, { isLoading: isResending }] =
    useResendChangePasswordOTPMutation()

  const [seconds, setSeconds] = useState(60)
  const [canResend, setCanResend] = useState(false)

  useEffect(() => {
    if (step !== 'otp' || canResend) return
    if (seconds <= 0) {
      setCanResend(true)
      return
    }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds, step, canResend])

  const requestForm = useForm<ChangePasswordRequestValues>({
    resolver: zodResolver(changePasswordRequestSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  })

  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' }
  })

  const onRequestSubmit = async (values: ChangePasswordRequestValues) => {
    try {
      await requestChange(values).unwrap()
      setStep('otp')
      setSeconds(60)
      setCanResend(false)
      toast.success('Verification code sent to your email')
    } catch (error) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Failed to send verification code')
    }
  }

  const onOtpSubmit = async (values: OtpValues) => {
    try {
      await verifyOTP(values).unwrap()
      toast.success('Password changed successfully. Please login again')
      setOpen(false)
      // Tự động logout hoặc để user tự logout theo logic BE trả về
      // Ở đây BE trả về "Please login again" và xóa hết refresh token nên user sẽ bị kick
      window.location.reload()
    } catch (error) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Invalid verification code')
      otpForm.reset()
    }
  }

  const handleResend = async () => {
    try {
      await resendOTP().unwrap()
      setSeconds(60)
      setCanResend(false)
      otpForm.reset()
      toast.success('New verification code sent.')
    } catch (error) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Failed to resend code')
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset state when closing
      setStep('form')
      requestForm.reset()
      otpForm.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <KeyRound className="h-4 w-4" />
          Change password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Enter your current password and a new one to change.
              </DialogDescription>
            </DialogHeader>
            <Form {...requestForm}>
              <form
                onSubmit={requestForm.handleSubmit(onRequestSubmit)}
                className="space-y-4 pt-4"
              >
                <FormField
                  control={requestForm.control}
                  name="oldPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={requestForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder="••••••"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={requestForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder="••••••"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isRequesting}>
                    {isRequesting && (
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Send verification code
                  </Button>
                </div>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center">
                Check your email
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={() => setStep('form')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </DialogTitle>
              <DialogDescription>
                We've sent a 6-digit code to your email.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-6 py-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <MailCheck className="h-6 w-6 text-primary" />
              </div>
              <Form {...otpForm}>
                <form
                  onSubmit={otpForm.handleSubmit(onOtpSubmit)}
                  className="w-full space-y-6"
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
                    {isVerifying && (
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Confirm Change
                  </Button>
                </form>
              </Form>
              <div className="text-sm text-center">
                {canResend ? (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleResend}
                    disabled={isResending}
                    className="h-auto p-0"
                  >
                    {isResending ? (
                      <Loader className="h-3 w-3 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-2" />
                    )}
                    Resend code
                  </Button>
                ) : (
                  <p className="text-muted-foreground italic">
                    Resend code in {seconds}s
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
