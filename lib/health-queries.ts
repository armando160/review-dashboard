import { supabase } from './supabase'

export interface HealthStats {
  reviews: {
    total: number
    classified: number
    unclassified: number
    positive: number
    negative: number
    neutral: number
    oldest_date: string | null
    newest_date: string | null
  }
  products: {
    total: number
    never_scraped: number
    on_cycle: number
    tier_1: number
    tier_2: number
    tier_3: number
    tier_4: number
    no_tier: number
    stale_7d: number
  }
  pipeline: {
    total_runs: number
    completed_runs: number
    error_runs: number
    total_found: number
    total_new: number
    last_run_at: string | null
    runs_last_24h: number
    new_last_24h: number
    new_last_7d: number
  }
}

export interface RecentRun {
  id: number
  asin: string
  reviews_found: number
  new_reviews: number
  status: string
  started_at: string
  completed_at: string | null
  error_message: string | null
}

export async function fetchHealthStats(): Promise<HealthStats> {
  const { data, error } = await supabase.rpc('data_health_stats')
  if (error) throw error
  return data as HealthStats
}

export async function fetchRecentRuns(limit = 25): Promise<RecentRun[]> {
  const { data } = await supabase
    .from('scrape_log')
    .select('id, asin, reviews_found, new_reviews, status, started_at, completed_at, error_message')
    .order('started_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as RecentRun[]
}
