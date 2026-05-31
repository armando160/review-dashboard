export type Brand =
  | 'Lifepro'
  | 'Oaktiv'
  | 'Petcove'
  | 'Joyberri'
  | 'Loft&Ivy'
  | 'Sunello'
  | 'Culvani'

export type Sentiment = 'positive' | 'negative' | 'neutral'

export type ReviewCategory =
  | 'Product Quality'
  | 'Usability & Design'
  | 'Value'
  | 'Customer Service'
  | 'Fulfillment'
  | 'Other'

export type Granularity = 'day' | 'week' | 'month'

export interface Filters {
  dateFrom: Date
  dateTo: Date
  brands: string[]
  asins: string[]
  ratings: number[]
  categories: ReviewCategory[]
  sentiments: Sentiment[]
  granularity: Granularity
}

export interface Product {
  asin: string
  product_name: string | null
  brand: string | null
  product_category: string | null
  status: string | null
  rating: number | null
  review_count: number | null
}

export interface Review {
  id: number
  asin: string
  author: string | null
  title: string | null
  review_text: string | null
  rating: number
  review_date: string
  is_verified_purchase: boolean | null
  is_vine_review: boolean | null
  helpful_votes: number | null
  image_count: number | null
  video_count: number | null
  sentiment: Sentiment | null
  review_category: ReviewCategory | null
  sentiment_confidence: number | null
  category_confidence: number | null
  scraped_at: string | null
}

export interface ReviewWithProduct extends Review {
  product_name: string | null
  brand: string | null
}

// Aggregated data shapes for charts

export interface VelocityDataPoint {
  period: string
  brand: string
  review_count: number
  avg_rating: number
}

export interface RatingEvolutionPoint {
  period: string
  [brand: string]: string | number
}

export interface CategorySentimentRow {
  review_category: string
  sentiment: string
  count: number
}

export interface HeatmapRow {
  brand: string
  review_category: string
  total: number
  positive: number
  negative: number
  positive_pct: number
}

export interface TopAsin {
  asin: string
  product_name: string | null
  brand: string | null
  avg_rating: number
  review_count: number
  review_velocity: number | null
  dominant_negative_category: string | null
}

export interface KpiData {
  totalReviews: number
  totalReviewsDelta: number
  avgRating: number
  avgRatingDelta: number
  positivePct: number
  positivePctDelta: number
  negativePct: number
  negativePctDelta: number
}

export interface ScatterPoint {
  asin: string
  product_name: string | null
  brand: string | null
  review_count: number
  avg_rating: number
}

export interface RatingDistributionRow {
  rating: number
  count: number
}

export interface ScrapeLogEntry {
  id: number
  asin: string
  reviews_found: number
  new_reviews: number
  completed_at: string | null
  status: string
}

export interface IssueTheme {
  id: number
  theme_label: string
  description: string | null
  category: string
  severity: string
  asin: string
  mention_count: number
  first_seen: string | null
  last_seen: string | null
  status: string
  created_at: string
  product_name?: string | null
  brand?: string | null
  reviews?: Array<{
    review_id: number
    relevance: string | null
    review: {
      id: number
      title: string | null
      review_text: string | null
      rating: number
      review_date: string
    }
  }>
}

export interface ProductFacet {
  id: number
  asin: string
  facet_name: string
  facet_type: string
  positive_count: number
  negative_count: number
  neutral_count: number
  total_mentions: number
  summary: string | null
  representative_quotes: Array<{
    review_id: number
    quote: string
    sentiment: string
  }> | null
  created_at: string
}
