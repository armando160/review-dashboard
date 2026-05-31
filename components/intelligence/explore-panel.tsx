'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchProducts, fetchProductFacets } from '@/lib/queries'
import { FacetCard } from './facet-card'
import { Search, Package, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product, ProductFacet } from '@/types'

export function ExplorePanel() {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [selectedAsin, setSelectedAsin] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [facets, setFacets] = useState<ProductFacet[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProducts().then(setProducts).catch(console.error)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return products
      .filter(
        (p) =>
          p.asin.toLowerCase().includes(q) ||
          (p.product_name ?? '').toLowerCase().includes(q)
      )
      .slice(0, 20)
  }, [query, products])

  // Top products by review count for the suggested section
  const suggestedProducts = useMemo(() => {
    return [...products]
      .filter((p) => (p.review_count ?? 0) > 0)
      .sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0))
      .slice(0, 10)
  }, [products])

  useEffect(() => {
    if (!selectedAsin) {
      setFacets([])
      return
    }
    setLoading(true)
    fetchProductFacets(selectedAsin)
      .then(setFacets)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedAsin])

  const handleSelect = (product: Product) => {
    setSelectedAsin(product.asin)
    setSelectedProduct(product)
    setQuery(product.product_name ?? product.asin)
    setShowDropdown(false)
  }

  return (
    <div className="space-y-6">
      {/* Product Search */}
      <div className="relative max-w-lg" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by product name or ASIN..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowDropdown(true)
              if (!e.target.value.trim()) {
                setSelectedAsin(null)
                setSelectedProduct(null)
              }
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {showDropdown && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.asin}
                className="w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => handleSelect(p)}
              >
                <span className="font-medium text-foreground">
                  {p.product_name ?? p.asin}
                </span>
                {p.brand && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {p.brand}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-2">
                  ({p.asin})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected product header */}
      {selectedProduct && (
        <div className="text-sm text-muted-foreground">
          Showing facets for{' '}
          <span className="font-medium text-foreground">
            {selectedProduct.product_name ?? selectedProduct.asin}
          </span>
          {selectedProduct.brand && (
            <span> ({selectedProduct.brand})</span>
          )}
        </div>
      )}

      {/* Facets Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-muted rounded-lg h-40" />
          ))}
        </div>
      ) : !selectedAsin ? (
        <div className="space-y-6">
          {/* Empty state prompt */}
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Select a product to explore customer feedback facets
            </p>
          </div>

          {/* Suggested products */}
          {suggestedProducts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">
                Products with most reviews
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {suggestedProducts.map((p) => (
                  <button
                    key={p.asin}
                    onClick={() => handleSelect(p)}
                    className={cn(
                      'bg-card border border-border rounded-lg p-3 text-left',
                      'hover:border-ring hover:bg-accent/50 transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-ring'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Package className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {p.product_name ?? p.asin}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {p.brand && (
                            <span className="text-xs text-muted-foreground">
                              {p.brand}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {p.review_count?.toLocaleString()} reviews
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : facets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground space-y-2">
          <AlertCircle className="w-6 h-6 mx-auto opacity-50" />
          <p className="text-sm font-medium">No facets found for this product</p>
          <p className="text-xs max-w-md mx-auto">
            Facets have not been generated for this product yet. Run the facet
            generation script to analyze its reviews and surface customer
            feedback themes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {facets.map((facet) => (
            <FacetCard key={facet.id} facet={facet} />
          ))}
        </div>
      )}
    </div>
  )
}
