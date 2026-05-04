import { useState } from 'react'
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
import { Loader } from 'lucide-react'
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

  const [file, setFile] = useState<File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [updateUserMutation, { isLoading }] = useUpdateUserMutation()

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: user?.name || '',
      profilePicture: user?.profilePicture || '',
      timezone: user?.timezone || 'Asia/Ho_Chi_Minh',
      preferredCurrency: user?.preferredCurrency || 'USD'
    }
  })

  const onSubmit = (values: AccountFormValues) => {
    if (isLoading) return

    const formData = new FormData()
    formData.append('name', values.name || '')
    formData.append('timezone', values.timezone || '')
    formData.append('preferredCurrency', values.preferredCurrency || '')
    if (file) formData.append('profilePicture', file)

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
    setFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setAvatarUrl(result)
    }
    reader.onerror = () => {
      toast.error('Failed to read image file')
      setFile(null)
      setAvatarUrl(null)
    }
    reader.readAsDataURL(file)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex flex-col items-start space-y-4">
          <FormLabel>Profile Picture</FormLabel>
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
          <FormLabel>Email Address</FormLabel>
          <Input
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button disabled={isLoading} type="submit">
          {isLoading && <Loader className="h-4 w-4 animate-spin" />}
          Update account
        </Button>
      </form>
    </Form>
  )
}
