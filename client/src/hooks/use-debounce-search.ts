import { useState, useEffect } from 'react'

interface UseDebouncedSearchOptions {
  delay?: number
  immediate?: boolean
}

const useDebouncedSearch = (
  initialValue: string,
  options: UseDebouncedSearchOptions = {}
) => {
  const { delay = 500, immediate = false } = options

  const [searchTerm, setSearchTerm] = useState(initialValue)
  const [debouncedTerm, setDebouncedTerm] = useState(initialValue)

  useEffect(() => {
    if (immediate && searchTerm === initialValue) {
      setDebouncedTerm(searchTerm)
      return
    }

    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [searchTerm, delay, initialValue, immediate])

  return { debouncedTerm, searchTerm, setSearchTerm }
}

export default useDebouncedSearch
