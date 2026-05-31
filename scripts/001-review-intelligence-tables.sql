-- Review Intelligence tables
-- Run this in Supabase SQL Editor before using the extraction scripts

-- Stores AI-extracted themes ("the switch fails after 3 weeks")
CREATE TABLE issue_themes (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  theme_label   TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  severity      TEXT DEFAULT 'medium',
  asin          TEXT NOT NULL REFERENCES products(asin),
  mention_count INT NOT NULL DEFAULT 0,
  first_seen    DATE,
  last_seen     DATE,
  status        TEXT DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Junction table linking themes to source reviews
CREATE TABLE issue_theme_reviews (
  theme_id   BIGINT NOT NULL REFERENCES issue_themes(id) ON DELETE CASCADE,
  review_id  BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  relevance  TEXT,
  PRIMARY KEY (theme_id, review_id)
);

-- Pre-generated facets per product for the Explore tab
CREATE TABLE product_facets (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asin                   TEXT NOT NULL REFERENCES products(asin),
  facet_name             TEXT NOT NULL,
  facet_type             TEXT DEFAULT 'feature',
  positive_count         INT DEFAULT 0,
  negative_count         INT DEFAULT 0,
  neutral_count          INT DEFAULT 0,
  total_mentions         INT DEFAULT 0,
  summary                TEXT,
  representative_quotes  JSONB,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asin, facet_name)
);

-- Tracks extraction script progress for resumability
CREATE TABLE theme_extraction_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asin          TEXT NOT NULL,
  reviews_sent  INT NOT NULL DEFAULT 0,
  tokens_used   INT,
  themes_found  INT DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  run_id        TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Full-text search index for the Ask tab
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(review_text, ''))
  ) STORED;

-- Tracks facet generation script progress (same structure as theme_extraction_log)
CREATE TABLE facet_extraction_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asin          TEXT NOT NULL,
  reviews_sent  INT NOT NULL DEFAULT 0,
  tokens_used   INT,
  facets_found  INT DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  run_id        TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_facet_extraction_log_run ON facet_extraction_log(run_id);
CREATE INDEX idx_facet_extraction_log_asin ON facet_extraction_log(asin);
CREATE INDEX idx_issue_themes_asin ON issue_themes(asin);
CREATE INDEX idx_issue_themes_status ON issue_themes(status);
CREATE INDEX idx_issue_theme_reviews_review ON issue_theme_reviews(review_id);
CREATE INDEX idx_product_facets_asin ON product_facets(asin);
CREATE INDEX idx_extraction_log_run ON theme_extraction_log(run_id);
CREATE INDEX idx_extraction_log_asin ON theme_extraction_log(asin);
CREATE INDEX idx_reviews_search ON reviews USING GIN(search_vector);
