import { useEffect, useRef, useState, useId } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAppDispatch, useTypedSelector } from '@/app/hook'
import { Loader, RefreshCw } from 'lucide-react'
import { useUpdateUserMutation } from '@/features/user/userAPI'
import { updateCredentials } from '@/features/auth/authSlice'
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from '@/constant'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

// 1. MỚI: Import API Dashboard và Enum để làm Prefetch
import { analyticsApi } from '@/features/analytics/analyticsAPI'
import { DateRangeEnum } from '@/components/date-range-select'
import { getBrowserTimeZone, normalizeTimeZone } from '@/lib/timezone'

const accountFormSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: 'Name must be at least 2 characters.'
    })
    .optional(),
  profilePicture: z.string().optional(), // Make optional to match file state
  timezone: z.string().optional(),
  preferredCurrency: z.string().optional()
})

type AccountFormValues = z.infer<typeof accountFormSchema>

export function AccountForm() {
  const dispatch = useAppDispatch()
  const { user } = useTypedSelector((state) => state.auth)

  const fileRef = useRef<File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isDetectingTimezone, setIsDetectingTimezone] = useState(false)

  const [updateUserMutation, { isLoading }] = useUpdateUserMutation()

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: user?.name || '',
      profilePicture: user?.profilePicture || '',
      timezone: normalizeTimeZone(user?.timezone) || 'Asia/Ho_Chi_Minh',
      preferredCurrency: user?.preferredCurrency || 'USD'
    }
  })

  useEffect(() => {
    form.reset(
      {
        name: user?.name || '',
        profilePicture: user?.profilePicture || '',
        timezone: normalizeTimeZone(user?.timezone) || 'Asia/Ho_Chi_Minh',
        preferredCurrency: user?.preferredCurrency || 'USD'
      },
      { keepDirtyValues: true }
    )
  }, [
    form,
    user?.name,
    user?.profilePicture,
    user?.preferredCurrency,
    user?.timezone
  ])

  const onSubmit = (values: AccountFormValues) => {
    if (isLoading) return

    const formData = new FormData()
    formData.append('name', values.name || '')
    formData.append('timezone', values.timezone || '')
    formData.append('preferredCurrency', values.preferredCurrency || '')
    if (fileRef.current) formData.append('profilePicture', fileRef.current)

    updateUserMutation(formData)
      .unwrap()
      .then((response) => {
        dispatch(
          updateCredentials({
            user: {
              profilePicture: response.data.profilePicture,
              name: response.data.name,
              timezone: response.data.timezone,
              preferredCurrency: response.data.preferredCurrency
            }
          })
        )
        toast.success('Account updated successfully')

        // 🚀 2. MỚI: TUYỆT CHIÊU PREFETCH CẢ 3 API 🚀
        const defaultParams = { preset: DateRangeEnum.LAST_30_DAYS }

        dispatch(
          analyticsApi.util.prefetch('summaryAnalytics', defaultParams, {
            force: true
          })
        )
        dispatch(
          analyticsApi.util.prefetch('chartAnalytics', defaultParams, {
            force: true
          })
        )
        dispatch(
          analyticsApi.util.prefetch(
            'expensePieChartBreakdown',
            defaultParams,
            { force: true }
          )
        )
        // 🚀 KẾT THÚC PREFETCH 🚀
      })
      .catch((error) => {
        toast.error(error?.data?.message || 'Failed to update account')
      })
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      toast.error('Please select a file')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    // Add file size validation (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024 // 5MB in bytes
    if (file.size > MAX_SIZE) {
      toast.error('Image size must be less than 5MB')
      return
    }
    fileRef.current = file
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setAvatarUrl(result)
    }
    reader.onerror = () => {
      toast.error('Failed to read image file')
      fileRef.current = null
      setAvatarUrl(null)
    }
    reader.readAsDataURL(file)
  }

  const handleUseBrowserTimezone = () => {
    setIsDetectingTimezone(true)
    window.setTimeout(() => setIsDetectingTimezone(false), 400)

    const browserTimezone = getBrowserTimeZone()

    if (!browserTimezone) {
      toast.error('Your browser timezone is not supported yet')
      return
    }

    form.setValue('timezone', browserTimezone, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true
    })
    toast.success(`Timezone set to ${browserTimezone}`)
  }

  const avatarInputId = useId()

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex flex-col items-start space-y-4">
          <label
            htmlFor={avatarInputId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Profile Picture
          </label>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={avatarUrl || user?.profilePicture || ''}
                className="!object-cover !object-center"
              />
              <AvatarFallback className="text-2xl">
                {form.watch('name')?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <Input
                id={avatarInputId}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="max-w-[250px]"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: Square JPG, PNG, at least 300x300px.
              </p>
            </div>
          </div>
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <label
            htmlFor="email-input"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Email Address
          </label>
          <Input
            id="email-input"
            value={user?.email || ''}
            disabled
            className="bg-muted/50 cursor-not-allowed"
          />
          <p className="text-[0.8rem] text-muted-foreground">
            Your email is used for login and security notifications.
          </p>
        </div>
        <FormField
          control={form.control}
          name="preferredCurrency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preferred Currency</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || 'USD'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => {
            const selectedTimezone = normalizeTimeZone(field.value)
            const timezoneOptions =
              selectedTimezone &&
              !TIMEZONE_OPTIONS.some((tz) => tz.value === selectedTimezone)
                ? [
                    ...TIMEZONE_OPTIONS,
                    { value: selectedTimezone, label: selectedTimezone }
                  ]
                : TIMEZONE_OPTIONS

            return (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    onValueChange={field.onChange}
                    value={selectedTimezone || field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timezoneOptions.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseBrowserTimezone}
                    disabled={isLoading || isDetectingTimezone}
                    className="h-8 gap-2 sm:w-auto"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isDetectingTimezone ? 'animate-spin' : ''}`}
                    />
                    Detect
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <Button disabled={isLoading} type="submit">
          {isLoading && <Loader className="h-4 w-4 animate-spin" />}
          Update account
        </Button>
      </form>
    </Form>
  )
}
