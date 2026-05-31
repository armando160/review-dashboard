import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CategoryStat {
  category: string
  negative: number
  positive: number
  neutral: number
  total: number
  negativePct: number        // % of this category's reviews that are negative
  shareOfAllNeg: number      // % of product's total negatives this category represents
  sampleQuotes: Array<{
    id: number
    text: string | null
    rating: number
    date: string
  }>
}

export interface ProductSnapshot {
  asin: string
  product_name: string | null
  brand: string | null
  amazon_rating: number | null    // from products table (Amazon listing)
  total_reviews: number           // from products table
  classified: number              // reviews we've run through LLM
  negative_count: number
  positive_count: number
  neutral_count: number
  negative_pct: number
  top_complaint_category: string | null
  categories: CategoryStat[]
}

export interface MonthlyNeg {
  month: string   // "2025-01"
  [category: string]: string | number
}

export interface NegativeReview {
  id: number
  asin: string
  title: string | null
  review_text: string | null
  rating: number
  review_date: string
  review_category: string | null
  sentiment?: string | null
}

// ── Portfolio Overview (all products) ─────────────────────────────────────────

export async function fetchPortfolioSnapshots(): Promise<ProductSnapshot[]> {
  // 1. All products (for name / brand / Amazon stats)
  const { data: products } = await supabase
    .from('products')
    .select('asin, product_name, brand, rating, review_count')

  // 2. All LLM-classified reviews — only 3 columns so the payload stays small
  const { data: classified } = await supabase
    .from('reviews')
    .select('asin, sentiment, review_category')
    .not('sentiment', 'is', null)

  const productMap = new Map<string, {
    product_name: string | null
    brand: string | null
    amazon_rating: number | null
    total_reviews: number
  }>()

  for (const p of (products ?? []) as Array<{
    asin: string
    product_name: string | null
    brand: string | null
    rating: number | null
    review_count: number | null
  }>) {
    productMap.set(p.asin, {
      product_name: p.product_name,
      brand: p.brand,
      amazon_rating: p.rating,
      total_reviews: p.review_count ?? 0,
    })
  }

  // Group classified reviews by asin → category → sentiment
  type CatBucket = { neg: number; pos: number; neu: number }
  const asinBuckets = new Map<string, { cats: Record<string, CatBucket> }>()

  for (const r of (classified ?? []) as Array<{
    asin: string
    sentiment: string
    review_category: string | null
  }>) {
    if (!asinBuckets.has(r.asin)) asinBuckets.set(r.asin, { cats: {} })
    const bucket = asinBuckets.get(r.asin)!
    const cat = r.review_category ?? 'Other'
    if (!bucket.cats[cat]) bucket.cats[cat] = { neg: 0, pos: 0, neu: 0 }
    if (r.sentiment === 'negative') bucket.cats[cat].neg++
    else if (r.sentiment === 'positive') bucket.cats[cat].pos++
    else bucket.cats[cat].neu++
  }

  const snapshots: ProductSnapshot[] = Array.from(asinBuckets.entries()).map(([asin, { cats }]) => {
    const meta = productMap.get(asin) ?? {
      product_name: null, brand: null, amazon_rating: null, total_reviews: 0,
    }

    let totalNeg = 0, totalPos = 0, totalNeu = 0
    const categories: CategoryStat[] = []

    for (const [cat, b] of Object.entries(cats)) {
      totalNeg += b.neg
      totalPos += b.pos
      totalNeu += b.neu
      const catTotal = b.neg + b.pos + b.neu
      categories.push({
        category: cat,
        negative: b.neg,
        positive: b.pos,
        neutral: b.neu,
        total: catTotal,
        negativePct: catTotal > 0 ? Math.round((b.neg / catTotal) * 1000) / 10 : 0,
        shareOfAllNeg: 0,  // filled below
        sampleQuotes: [],  // not needed in overview
      })
    }

    // Compute shareOfAllNeg now that we know totalNeg
    for (const cat of categories) {
      cat.shareOfAllNeg = totalNeg > 0 ? Math.round((cat.negative / totalNeg) * 1000) / 10 : 0
    }
    categories.sort((a, b) => b.negative - a.negative)

    const classified = totalNeg + totalPos + totalNeu
    const topComplaint = categories[0]?.negative > 0 ? categories[0].category : null

    return {
      asin,
      product_name: meta.product_name,
      brand: meta.brand,
      amazon_rating: meta.amazon_rating,
      total_reviews: meta.total_reviews,
      classified,
      negative_count: totalNeg,
      positive_count: totalPos,
      neutral_count: totalNeu,
      negative_pct: classified > 0 ? Math.round((totalNeg / classified) * 1000) / 10 : 0,
      top_complaint_category: topComplaint,
      categories,
    }
  })

  // Include products with zero classified reviews too
  for (const [asin, meta] of productMap.entries()) {
    if (!asinBuckets.has(asin)) {
      snapshots.push({
        asin,
        product_name: meta.product_name,
        brand: meta.brand,
        amazon_rating: meta.amazon_rating,
        total_reviews: meta.total_reviews,
        classified: 0,
        negative_count: 0,
        positive_count: 0,
        neutral_count: 0,
        negative_pct: 0,
        top_complaint_category: null,
        categories: [],
      })
    }
  }

  return snapshots.sort((a, b) => b.negative_count - a.negative_count)
}

// ── Single-product Drilldown ───────────────────────────────────────────────────

export async function fetchProductDrilldown(asin: string): Promise<{
  categories: CategoryStat[]
  trend: MonthlyNeg[]
  recentNegatives: NegativeReview[]
}> {
  const { data } = await supabase
    .from('reviews')
    .select('id, asin, title, review_text, rating, review_date, sentiment, review_category')
    .eq('asin', asin)
    .not('sentiment', 'is', null)
    .order('review_date', { ascending: false })

  const rows = (data ?? []) as NegativeReview[]

  type CatBucket = { neg: NegativeReview[]; pos: number; neu: number }
  const catMap = new Map<string, CatBucket>()
  const monthMap = new Map<string, Record<string, number>>()

  for (const r of rows) {
    const cat = r.review_category ?? 'Other'

    if (!catMap.has(cat)) catMap.set(cat, { neg: [], pos: 0, neu: 0 })
    const b = catMap.get(cat)!

    if (r.sentiment === 'negative') {
      b.neg.push(r)
      // Monthly trend
      const month = r.review_date.substring(0, 7)
      if (!monthMap.has(month)) monthMap.set(month, {})
      const m = monthMap.get(month)!
      m[cat] = (m[cat] ?? 0) + 1
    } else if (r.sentiment === 'positive') {
      b.pos++
    } else {
      b.neu++
    }
  }

  const totalNeg = rows.filter(r => r.sentiment === 'negative').length

  const categories: CategoryStat[] = Array.from(catMap.entries()).map(([cat, b]) => {
    const catTotal = b.neg.length + b.pos + b.neu
    return {
      category: cat,
      negative: b.neg.length,
      positive: b.pos,
      neutral: b.neu,
      total: catTotal,
      negativePct: catTotal > 0 ? Math.round((b.neg.length / catTotal) * 1000) / 10 : 0,
      shareOfAllNeg: totalNeg > 0 ? Math.round((b.neg.length / totalNeg) * 1000) / 10 : 0,
      // All negative reviews for this category (used for full expansion in UI)
      sampleQuotes: b.neg.map(r => ({
        id: r.id,
        text: r.review_text,
        rating: r.rating,
        date: r.review_date,
      })),
    }
  }).sort((a, b) => b.negative - a.negative)

  const trend: MonthlyNeg[] = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)  // last 12 months only
    .map(([month, cats]) => ({ month, ...cats }))

  const recentNegatives = rows
    .filter(r => r.sentiment === 'negative')
    .slice(0, 60)

  return { categories, trend, recentNegatives }
}
