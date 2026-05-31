'use client'

import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ALL_BRANDS, cn } from '@/lib/utils'
import { Send, Sparkles, MessageCircleQuestion } from 'lucide-react'

const EXAMPLE_QUESTIONS = [
  'What do customers say about the timer on the Lifepro belt?',
  'What are the top complaints about Petcove products?',
  'How do customers feel about the build quality of Oaktiv items?',
  'Which products have the most complaints about packaging?',
  'What features do customers love most across all brands?',
]

export function AskPanel() {
  const [question, setQuestion] = useState('')
  const [brands, setBrands] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)

  const toggleBrand = (brand: string) =>
    setBrands(brands.includes(brand) ? brands.filter((b) => b !== brand) : [...brands, brand])

  const handleSubmit = () => {
    if (!question.trim()) return
    setSubmitted(true)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Example question pills */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Try an example question:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((example) => (
            <Button
              key={example}
              variant="outline"
              size="sm"
              className="h-auto py-1.5 px-3 text-xs text-muted-foreground hover:text-foreground whitespace-normal text-left"
              onClick={() => {
                setQuestion(example)
                setSubmitted(false)
              }}
            >
              <MessageCircleQuestion className="w-3 h-3 mr-1.5 shrink-0" />
              {example}
            </Button>
          ))}
        </div>
      </div>

      {/* Question input */}
      <div className="space-y-2">
        <div className="relative">
          <textarea
            placeholder="Ask a question about your reviews..."
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value)
              setSubmitted(false)
            }}
            rows={3}
            className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Searches your review database and provides AI-generated answers with citations.
        </p>

        <div className="flex items-center gap-2">
          {/* Brand filter */}
          <Popover>
            <PopoverTrigger
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1.5')}
            >
              Filter by brand
              {brands.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {brands.length}
                </Badge>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="space-y-2">
                {ALL_BRANDS.map((brand) => (
                  <div key={brand} className="flex items-center gap-2">
                    <Checkbox
                      id={`ask-brand-${brand}`}
                      checked={brands.includes(brand)}
                      onCheckedChange={() => toggleBrand(brand)}
                    />
                    <Label htmlFor={`ask-brand-${brand}`} className="text-sm font-normal cursor-pointer">
                      {brand}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="sm"
            className="h-8 gap-1.5 ml-auto"
            onClick={handleSubmit}
            disabled={!question.trim()}
          >
            <Send className="w-3.5 h-3.5" />
            Ask
          </Button>
        </div>
      </div>

      {/* Response area */}
      {submitted && (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="text-center space-y-3">
            <Sparkles className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              AI-powered Q&A coming soon. This will search your reviews and provide
              AI-generated answers with citations.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
