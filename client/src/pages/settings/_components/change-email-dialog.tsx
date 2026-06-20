import { useState, useRef, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader, Mail, RefreshCw, ArrowLeft } from 'lucide-react'

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
import { Input } from '@/components/ui/input'
import {
  useChangeEmailRequestMutation,
  useVerifyChangeEmailOTPMutation,
  useResendChangeEmailOTPMutation
} from '@/features/auth/authAPI'
import { useAppDispatch } from '@/app/hook'
import { logout } from '@/features/auth/authSlice'
import { apiClient } from '@/app/api-client'
import { saveFlashMessage } from '@/lib/flash-message'
import { redirectTo } from '@/lib/navigation'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const changeEmailRequestSchema = z.object({
  newEmail: z.string().email('Invalid email address')
})

const otpSchema = z.object({
  oldEmailOtp: z
    .string()
    .length(6, 'Old email OTP must be 6 digits')
    .regex(/^\d+$/, 'OTP must contain only numbers'),
  newEmailOtp: z
    .string()
    .length(6, 'New email OTP must be 6 digits')
    .regex(/^\d+$/, 'OTP must contain only numbers')
})

type ChangeEmailRequestValues = z.infer<typeof changeEmailRequestSchema>
type OtpValues = z.infer<typeof otpSchema>

// ─── OTP Input Component (Shared internal) ────────────────────────────────────

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const OtpInput = ({ value, onChange, disabled }: OtpInputProps) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6)

  const handleChange = (index: number, char: string) => {
    const newVal = char.replace(/\D/g, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = newVal
    onChange(newDigits.join(''))

    if (newVal && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits]
        newDigits[index - 1] = ''
        onChange(newDigits.join(''))
        inputsRef.current[index - 1]?.focus()
      } else {
        const newDigits = [...digits]
        newDigits[index] = ''
        onChange(newDigits.join(''))
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
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={2}
          disabled={disabled}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
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

export function ChangeEmailDialog() {
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [pendingEmail, setPendingEmail] = useState('')

  const [requestChange, { isLoading: isRequesting }] =
    useChangeEmailRequestMutation()
  const [verifyOTP, { isLoading: isVerifying }] =
    useVerifyChangeEmailOTPMutation()
  const [resendOTP, { isLoading: isResending }] =
    useResendChangeEmailOTPMutation()

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

  const requestForm = useForm<ChangeEmailRequestValues>({
    resolver: zodResolver(changeEmailRequestSchema),
    defaultValues: {
      newEmail: ''
    }
  })

  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { oldEmailOtp: '', newEmailOtp: '' }
  })

  const onRequestSubmit = async (values: ChangeEmailRequestValues) => {
    try {
      await requestChange(values).unwrap()
      setPendingEmail(values.newEmail)
      setStep('otp')
      setSeconds(60)
      setCanResend(false)
      toast.success('Verification codes sent to both emails')
    } catch (error) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Failed to send verification code')
    }
  }

  const onOtpSubmit = async (values: OtpValues) => {
    try {
      await verifyOTP(values).unwrap()
      saveFlashMessage({
        message: 'Email updated successfully. Please sign in again',
        type: 'success'
      })
      setOpen(false)
      dispatch(logout())
      dispatch(apiClient.util.resetApiState())
      localStorage.removeItem('persist:root')
      redirectTo('/')
    } catch (error) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Invalid verification codes')
      otpForm.reset({ oldEmailOtp: '', newEmailOtp: '' })
    }
  }

  const handleResend = async () => {
    try {
      await resendOTP().unwrap()
      setSeconds(60)
      setCanResend(false)
      otpForm.reset({ oldEmailOtp: '', newEmailOtp: '' })
      toast.success('New verification codes sent')
    } catch (error) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Failed to resend code')
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setStep('form')
      requestForm.reset()
      otpForm.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Mail className="h-4 w-4" />
          Change email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Change Email Address</DialogTitle>
              <DialogDescription>
                We'll send two separate codes to both your current and new email
                addresses to verify this change.
              </DialogDescription>
            </DialogHeader>
            <Form {...requestForm}>
              <form
                onSubmit={requestForm.handleSubmit(onRequestSubmit)}
                className="space-y-4 pt-4"
              >
                <FormField
                  control={requestForm.control}
                  name="newEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="new-email@example.com" {...field} />
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
                    Send verification codes
                  </Button>
                </div>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center">
                Double Verification Required
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
                Please enter the 6-digit codes sent to your emails.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-6 py-4">
              <Form {...otpForm}>
                <form
                  onSubmit={otpForm.handleSubmit(onOtpSubmit)}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <FormField
                      control={otpForm.control}
                      name="oldEmailOtp"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            Step 1: Code from Current Email
                          </FormLabel>
                          <FormControl>
                            <OtpInput
                              value={field.value}
                              onChange={field.onChange}
                              disabled={isVerifying}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="border-t border-dashed" />
                    <FormField
                      control={otpForm.control}
                      name="newEmailOtp"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Step 2: Code from New Email ({pendingEmail})
                          </FormLabel>
                          <FormControl>
                            <OtpInput
                              value={field.value}
                              onChange={field.onChange}
                              disabled={isVerifying}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      isVerifying ||
                      otpForm.watch('oldEmailOtp').length < 6 ||
                      otpForm.watch('newEmailOtp').length < 6
                    }
                  >
                    {isVerifying && (
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Confirm & Update Email
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
                    className="h-auto p-0 text-primary"
                  >
                    {isResending ? (
                      <Loader className="h-3 w-3 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-2" />
                    )}
                    Resend both codes
                  </Button>
                ) : (
                  <p className="text-muted-foreground italic">
                    Resend codes in {seconds}s
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
