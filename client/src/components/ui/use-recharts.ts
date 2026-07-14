import * as React from 'react'

type RechartsModule = typeof import('recharts')

let rechartsPromise: Promise<RechartsModule> | null = null

const loadRecharts = () => {
  rechartsPromise ??= import('recharts')
  return rechartsPromise
}

export const useRecharts = () => {
  const [recharts, setRecharts] = React.useState<RechartsModule | null>(null)

  React.useEffect(() => {
    let cancelled = false

    void loadRecharts().then((module) => {
      if (!cancelled) {
        setRecharts(module)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return recharts
}
