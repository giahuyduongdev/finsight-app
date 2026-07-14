import { useReducer, useCallback } from 'react'

interface UseProgressLoaderOptions {
  initialProgress?: number
  completionDelay?: number
}

interface UseProgressLoaderReturn {
  progress: number
  isLoading: boolean
  startProgress: (initial?: number) => void
  updateProgress: (value: number) => void
  doneProgress: () => void
  resetProgress: () => void
}

export function useProgressLoader(
  options: UseProgressLoaderOptions = {}
): UseProgressLoaderReturn {
  const { initialProgress = 10, completionDelay = 500 } = options

  const [state, updateState] = useReducer(
    (
      current: { progress: number; isLoading: boolean },
      nextState: Partial<{ progress: number; isLoading: boolean }>
    ) => ({ ...current, ...nextState }),
    { progress: 0, isLoading: false }
  )

  const startProgress = useCallback(
    (initial = initialProgress) => {
      updateState({
        progress: Math.min(Math.max(initial, 0), 100),
        isLoading: true
      })
    },
    [initialProgress]
  )

  const updateProgress = useCallback((value: number) => {
    updateState({
      progress: Math.min(Math.max(value, 0), 100)
    })
  }, [])

  const doneProgress = useCallback(() => {
    updateState({ progress: 100, isLoading: true })
    const timer = setTimeout(
      () => updateState({ progress: 100, isLoading: false }),
      completionDelay
    )
    return () => clearTimeout(timer)
  }, [completionDelay])

  const resetProgress = useCallback(() => {
    updateState({ progress: 0, isLoading: false })
  }, [])

  return {
    progress: state.progress,
    isLoading: state.isLoading,
    startProgress,
    updateProgress,
    doneProgress,
    resetProgress
  }
}
