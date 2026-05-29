import { supabase } from './supabase'
import type {
  Filters,
  VelocityDataPoint,
  CategorySentimentRow,
  HeatmapRow,
  TopAsin,
  KpiData,
  ScatterPoint,
  RatingDistributionRow,
  ReviewWithProduct,
  Product,
} from '@/types'
import { subDays } from 'date-fns'

function fmt(d: Date) {
  return d.toISOString().split('T')[0]
}

// ─── KPI Scorecards ────────────────────────────────────────────────────────────

export async function fetchKpis(filters: Filters): Promise<KpiData> {
  const { dateFrom, dateTo, brands } = filters
  const periodDays = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / 86400000)
  const prevFrom = subDays(dateFrom, periodDays)
  const prevTo = subDays(dateFrom, 1)

  async function getPeriodStats(from: Date, to: Date) {
    let q = supabase
      .from('reviews')
      .select('rating, sentiment, products!inner(brand)', { count: 'exact' })
      .gte('review_date', fmt(from))
      .lte('review_date', fmt(to))

    if (brands.length > 0) {
      q = q.in('products.brand', brands)
    }

    const { data, count } = await q
    const total = count ?? 0
    const rows = (data ?? []) as unknown as Array<{ rating: number; sentiment: string | null }>
    const avgRating = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0
    const classified = rows.filter((r) => r.sentiment != null)
    const posCount = classified.filter((r) => r.sentiment === 'positive').length
    const negCount = classified.filter((r) => r.sentiment === 'negative').length
    const posPct = classified.length ? (posCount / classified.length) * 100 : 0
    const negPct = classified.length ? (negCount / classified.length) * 100 : 0
    return { total, avgRating, posPct, negPct }
  }

  const [curr, prev] = await Promise.all([
    getPeriodStats(dateFrom, dateTo),
    getPeriodStats(prevFrom, prevTo),
  ])

  const reviewsDelta =
    prev.total > 0 ? Math.round(((curr.total - prev.total) / prev.total) * 100) : 0

  return {
    totalReviews: curr.total,
    totalReviewsDelta: reviewsDelta,
    avgRating: Math.round(curr.avgRating * 100) / 100,
    avgRatingDelta: Math.round((curr.avgRating - prev.avgRating) * 100) / 100,
    positivePct: Math.round(curr.posPct * 10) / 10,
    positivePctDelta: Math.round((curr.posPct - prev.posPct) * 10) / 10,
    negativePct: Math.round(curr.negPct * 10) / 10,
    negativePctDelta: Math.round((curr.negPct - prev.negPct) * 10) / 10,
  }
}

// ─── Review Velocity ───────────────────────────────────────────────────────────

export async function fetchVelocity(filters: Filters): Promise<VelocityDataPoint[]> {
  const { dateFrom, dateTo, brands, granularity, ratings, asins } = filters

  const gran = granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month'

  let q = supabase.rpc('reviews_by_period', {
    p_from: fmt(dateFrom),
    p_to: fmt(dateTo),
    p_granularity: gran,
    p_brands: brands.length > 0 ? brands : null,
    p_ratings: ratings.length > 0 ? ratings : null,
    p_asins: asins.length > 0 ? asins : null,
  })

  const { data, error } = await q
  if (error) {
    // Fallback: direct query without RPC
    return fetchVelocityDirect(filters)
  }
  return (data ?? []) as VelocityDataPoint[]
}

async function fetchVelocityDirect(filters: Filters): Promise<VelocityDataPoint[]> {
  const { dateFrom, dateTo, brands, asins, ratings } = filters

  let q = supabase
    .from('reviews')
    .select('review_date, rating, asin, products!inner(brand)')
    .gte('review_date', fmt(dateFrom))
    .lte('review_date', fmt(dateTo))

  if (brands.length > 0) q = q.in('products.brand', brands)
  if (asins.length > 0) q = q.in('asin', asins)
  if (ratings.length > 0) q = q.in('rating', ratings)

  const { data } = await q
  const rows = (data ?? []) as unknown as Array<{
    review_date: string
    rating: number
    asin: string
    products: { brand: string } | null
  }>

  // Group by period + brand client-side
  const map = new Map<string, { count: number; ratingSum: number }>()
  for (const r of rows) {
    const brand = r.products?.brand ?? 'Unknown'
    const key = `${r.review_date}||${brand}`
    const existing = map.get(key) ?? { count: 0, ratingSum: 0 }
    map.set(key, { count: existing.count + 1, ratingSum: existing.ratingSum + r.rating })
  }

  return Array.from(map.entries()).map(([key, val]) => {
    const [period, brand] = key.split('||')
    return {
      period,
      brand,
      review_count: val.count,
      avg_rating: Math.round((val.ratingSum / val.count) * 100) / 100,
    }
  })
}

// ─── Rating Evolution by Brand ────────────────────────────────────────────────

export async function fetchRatingEvolution(
  filters: Filters
): Promise<Array<{ period: string; [brand: string]: string | number }>> {
  const points = await fetchVelocityDirect(filters)

  const periodMap = new Map<string, Record<string, { sum: number; count: number }>>()
  for (const p of points) {
    if (!periodMap.has(p.period)) periodMap.set(p.period, {})
    const brandMap = periodMap.get(p.period)!
    if (!brandMap[p.brand]) brandMap[p.brand] = { sum: 0, count: 0 }
    brandMap[p.brand].sum += p.avg_rating * p.review_count
    brandMap[p.brand].count += p.review_count
  }

  return Array.from(periodMap.entries())
    .map(([period, brands]) => {
      const row: { period: string; [b: string]: string | number } = { period }
      for (const [brand, { sum, count }] of Object.entries(brands)) {
        row[brand] = Math.round((sum / count) * 100) / 100
      }
      return row
    })
    .sort((a, b) => String(a.period).localeCompare(String(b.period)))
}

// ─── Category Sentiment ────────────────────────────────────────────────────────

export async function fetchCategorySentiment(filters: Filters): Promise<CategorySentimentRow[]> {
  const { dateFrom, dateTo, brands, asins, ratings, categories, sentiments } = filters

  let q = supabase
    .from('reviews')
    .select('review_category, sentiment, products!inner(brand)')
    .gte('review_date', fmt(dateFrom))
    .lte('review_date', fmt(dateTo))
    .not('sentiment', 'is', null)
    .not('review_category', 'is', null)

  if (brands.length > 0) q = q.in('products.brand', brands)
  if (asins.length > 0) q = q.in('asin', asins)
  if (ratings.length > 0) q = q.in('rating', ratings)
  if (categories.length > 0) q = q.in('review_category', categories)
  if (sentiments.length > 0) q = q.in('sentiment', sentiments)

  const { data } = await q
  const rows = (data ?? []) as unknown as Array<{
    review_category: string
    sentiment: string
  }>

  const map = new Map<string, number>()
  for (const r of rows) {
    const key = `${r.review_category}||${r.sentiment}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  return Array.from(map.entries()).map(([key, count]) => {
    const [review_category, sentiment] = key.split('||')
    return { review_category, sentiment, count }
  })
}

// ─── Heatmap ───────────────────────────────────────────────────────────────────

export async function fetchHeatmap(filters: Filters): Promise<HeatmapRow[]> {
  const { dateFrom, dateTo, brands, asins, ratings } = filters

  let q = supabase
    .from('reviews')
    .select('review_category, sentiment, products!inner(brand)')
    .gte('review_date', fmt(dateFrom))
    .lte('review_date', fmt(dateTo))
    .not('sentiment', 'is', null)
    .not('review_category', 'is', null)

  if (brands.length > 0) q = q.in('products.brand', brands)
  if (asins.length > 0) q = q.in('asin', asins)
  if (ratings.length > 0) q = q.in('rating', ratings)

  const { data } = await q
  const rows = (data ?? []) as unknown as Array<{
    review_category: string
    sentiment: string
    products: { brand: string } | null
  }>

  const map = new Map<string, { total: number; positive: number; negative: number }>()
  for (const r of rows) {
    const brand = r.products?.brand ?? 'Unknown'
    const key = `${brand}||${r.review_category}`
    const e = map.get(key) ?? { total: 0, positive: 0, negative: 0 }
    e.total++
    if (r.sentiment === 'positive') e.positive++
    if (r.sentiment === 'negative') e.negative++
    map.set(key, e)
  }

  return Array.from(map.entries()).map(([key, val]) => {
    const [brand, review_category] = key.split('||')
    return {
      brand,
      review_category,
      total: val.total,
      positive: val.positive,
      negative: val.negative,
      positive_pct: val.total > 0 ? Math.round((val.positive / val.total) * 1000) / 10 : 0,
    }
  })
}

// ─── Top / Bottom ASINs ────────────────────────────────────────────────────────

export async function fetchTopAsins(
  filters: Filters,
  order: 'asc' | 'desc' = 'desc',
  limit = 10
): Promise<TopAsin[]> {
  const { dateFrom, dateTo, brands, asins, ratings } = filters

  let q = supabase
    .from('reviews')
    .select('asin, rating, review_date, review_category, sentiment, products!inner(product_name, brand)')
    .gte('review_date', fmt(dateFrom))
    .lte('review_date', fmt(dateTo))

  if (brands.length > 0) q = q.in('products.brand', brands)
  if (asins.length > 0) q = q.in('asin', asins)
  if (ratings.length > 0) q = q.in('rating', ratings)

  const { data } = await q
  const rows = (data ?? []) as unknown as Array<{
    asin: string
    rating: number
    review_date: string
    review_category: string | null
    sentiment: string | null
    products: { product_name: string | null; brand: string | null } | null
  }>

  const map = new Map<
    string,
    {
      product_name: string | null
      brand: string | null
      ratingSum: number
      count: number
      negCats: Record<string, number>
    }
  >()

  for (const r of rows) {
    const e = map.get(r.asin) ?? {
      product_name: r.products?.product_name ?? null,
      brand: r.products?.brand ?? null,
      ratingSum: 0,
      count: 0,
      negCats: {},
    }
    e.ratingSum += r.rating
    e.count++
    if (r.sentiment === 'negative' && r.review_category) {
      e.negCats[r.review_category] = (e.negCats[r.review_category] ?? 0) + 1
    }
    map.set(r.asin, e)
  }

  const result = Array.from(map.entries()).map(([asin, val]) => {
    const avgRating = val.count > 0 ? val.ratingSum / val.count : 0
    const negEntries = Object.entries(val.negCats)
    const dominantNeg =
      negEntries.length > 0 ? negEntries.sort((a, b) => b[1] - a[1])[0][0] : null
    return {
      asin,
      product_name: val.product_name,
      brand: val.brand,
      avg_rating: Math.round(avgRating * 100) / 100,
      review_count: val.count,
      review_velocity: null,
      dominant_negative_category: dominantNeg,
    }
  })

  return result
    .sort((a, b) =>
      order === 'desc' ? b.avg_rating - a.avg_rating : a.avg_rating - b.avg_rating
    )
    .slice(0, limit)
}

// ─── Scatter Plot ─────────────────────────────────────────────────────────────

export async function fetchScatterData(filters: Filters): Promise<ScatterPoint[]> {
  const { dateFrom, dateTo, brands, asins } = filters

  let q = supabase
    .from('reviews')
    .select('asin, rating, products!inner(product_name, brand)')
    .gte('review_date', fmt(dateFrom))
    .lte('review_date', fmt(dateTo))

  if (brands.length > 0) q = q.in('products.brand', brands)
  if (asins.length > 0) q = q.in('asin', asins)

  const { data } = await q
  const rows = (data ?? []) as unknown as Array<{
    asin: string
    rating: number
    products: { product_name: string | null; brand: string | null } | null
  }>

  const map = new Map<string, { pn: string | null; brand: string | null; sum: number; count: number }>()
  for (const r of rows) {
    const e = map.get(r.asin) ?? {
      pn: r.products?.product_name ?? null,
      brand: r.products?.brand ?? null,
      sum: 0,
      count: 0,
    }
    e.sum += r.rating
    e.count++
    map.set(r.asin, e)
  }

  return Array.from(map.entries()).map(([asin, val]) => ({
    asin,
    product_name: val.pn,
    brand: val.brand,
    review_count: val.count,
    avg_rating: val.count > 0 ? Math.round((val.sum / val.count) * 100) / 100 : 0,
  }))
}

// ─── Rating Distribution ──────────────────────────────────────────────────────

export async function fetchRatingDistribution(
  filters: Filters
): Promise<RatingDistributionRow[]> {
  const { dateFrom, dateTo, brands, asins } = filters

  let q = supabase
    .from('reviews')
    .select('rating, products!inner(brand)')
    .gte('review_date', fmt(dateFrom))
    .lte('review_date', fmt(dateTo))

  if (brands.length > 0) q = q.in('products.brand', brands)
  if (asins.length > 0) q = q.in('asin', asins)

  const { data } = await q
  const rows = (data ?? []) as unknown as Array<{ rating: number }>
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of rows) counts[r.rating] = (counts[r.rating] ?? 0) + 1
  return [5, 4, 3, 2, 1].map((rating) => ({ rating, count: counts[rating] ?? 0 }))
}

// ─── Review Drill-Down ────────────────────────────────────────────────────────

export async function fetchReviews(
  filters: Filters,
  page = 0,
  pageSize = 100
): Promise<{ data: ReviewWithProduct[]; count: number }> {
  const { dateFrom, dateTo, brands, asins, ratings, categories, sentiments } = filters

  let q = supabase
    .from('reviews')
    .select(
      'id, asin, title, review_text, rating, review_date, is_verified_purchase, is_vine_review, sentiment, review_category, products!inner(product_name, brand)',
      { count: 'exact' }
    )
    .gte('review_date', fmt(dateFrom))
    .lte('review_date', fmt(dateTo))
    .order('review_date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (brands.length > 0) q = q.in('products.brand', brands)
  if (asins.length > 0) q = q.in('asin', asins)
  if (ratings.length > 0) q = q.in('rating', ratings)
  if (categories.length > 0) q = q.in('review_category', categories)
  if (sentiments.length > 0) q = q.in('sentiment', sentiments)

  const { data, count } = await q
  const rows = (data ?? []) as unknown as Array<
    Omit<ReviewWithProduct, 'product_name' | 'brand'> & {
      products: { product_name: string | null; brand: string | null } | null
    }
  >

  return {
    data: rows.map((r) => ({
      ...r,
      product_name: r.products?.product_name ?? null,
      brand: r.products?.brand ?? null,
    })),
    count: count ?? 0,
  }
}

// ─── Products (for ASIN filter) ───────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select('asin, product_name, brand, product_category, status, rating, review_count')
    .order('product_name')
  return (data ?? []) as Product[]
}

// ─── Last scrape date ─────────────────────────────────────────────────────────

export async function fetchLastScrapeDate(): Promise<string | null> {
  const { data } = await supabase
    .from('scrape_log')
    .select('completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()
  return data?.completed_at ?? null
}
