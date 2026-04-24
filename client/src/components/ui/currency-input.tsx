import { forwardRef } from 'react'
import CurrencyInput from 'react-currency-input-field'
import { cn } from '@/lib/utils'

interface CurrencyInputFieldProps {
  id?: string
  name: string
  value?: string
  onValueChange?: (value?: string, name?: string) => void
  placeholder?: string
  className?: string
  prefix?: string
  decimalsLimit?: number
  allowDecimals?: boolean
  disabled?: boolean
  /**
   * autoFocus can negatively impact accessibility by moving focus unexpectedly.
   * Use sparingly and only when it clearly improves UX (e.g., primary input in a modal).
   */
  autoFocus?: boolean
}

const CurrencyInputField = forwardRef<
  HTMLInputElement,
  CurrencyInputFieldProps
>(
  (
      {
        id,
        name,
        value,
        onValueChange,
        placeholder,
        className,
        prefix = '$',
        disabled,
        decimalsLimit,
        allowDecimals,
        autoFocus
      },
    ref
  ) => {
    return (
      <CurrencyInput
        id={id || name}
        name={name}
        value={value}
        decimalsLimit={decimalsLimit}
        allowDecimals={allowDecimals}
        onValueChange={onValueChange}
        prefix={prefix}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          className
        )}
        ref={ref}
      />
    )
  }
)

CurrencyInputField.displayName = 'CurrencyInputField'

export default CurrencyInputField
