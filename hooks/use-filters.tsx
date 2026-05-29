'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { subDays } from 'date-fns'
import type { Filters, Granularity, ReviewCategory, Sentiment } from '@/types'

const defaultFilters: Filters = {
  dateFrom: subDays(new Date(), 30),
  dateTo: new Date(),
  brands: [],
  asins: [],
  ratings: [],
  categories: [],
  sentiments: [],
  granularity: 'week',
}

interface FiltersContextValue {
  filters: Filters
  setDateRange: (from: Date, to: Date) => void
  setBrands: (brands: string[]) => void
  setAsins: (asins: string[]) => void
  setRatings: (ratings: number[]) => void
  setCategories: (categories: ReviewCategory[]) => void
  setSentiments: (sentiments: Sentiment[]) => void
  setGranularity: (g: Granularity) => void
  resetFilters: () => void
}

export const FiltersContext = createContext<FiltersContextValue>({
  filters: defaultFilters,
  setDateRange: () => {},
  setBrands: () => {},
  setAsins: () => {},
  setRatings: () => {},
  setCategories: () => {},
  setSentiments: () => {},
  setGranularity: () => {},
  resetFilters: () => {},
})

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(defaultFilters)

  const setDateRange = useCallback(
    (from: Date, to: Date) => setFilters((f) => ({ ...f, dateFrom: from, dateTo: to })),
    []
  )
  const setBrands = useCallback(
    (brands: string[]) => setFilters((f) => ({ ...f, brands })),
    []
  )
  const setAsins = useCallback(
    (asins: string[]) => setFilters((f) => ({ ...f, asins })),
    []
  )
  const setRatings = useCallback(
    (ratings: number[]) => setFilters((f) => ({ ...f, ratings })),
    []
  )
  const setCategories = useCallback(
    (categories: ReviewCategory[]) => setFilters((f) => ({ ...f, categories })),
    []
  )
  const setSentiments = useCallback(
    (sentiments: Sentiment[]) => setFilters((f) => ({ ...f, sentiments })),
    []
  )
  const setGranularity = useCallback(
    (granularity: Granularity) => setFilters((f) => ({ ...f, granularity })),
    []
  )
  const resetFilters = useCallback(() => setFilters(defaultFilters), [])

  return (
    <FiltersContext.Provider
      value={{
        filters,
        setDateRange,
        setBrands,
        setAsins,
        setRatings,
        setCategories,
        setSentiments,
        setGranularity,
        resetFilters,
      }}
    >
      {children}
    </FiltersContext.Provider>
  )
}

export function useFilters() {
  return useContext(FiltersContext)
}
