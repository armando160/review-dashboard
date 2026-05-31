import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export interface AnalysisTheme {
  title: string
  severity: 'high' | 'medium' | 'low'
  count: number
  summary: string
  quotes: string[]
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'No AI API key configured. Add ANTHROPIC_API_KEY to your environment variables.' },
      { status: 503 }
    )
  }

  const body = await req.json()
  const { asin, productName, reviews } = body as {
    asin: string
    productName: string
    reviews: Array<{ id: number; text: string | null; rating: number; category: string | null; date: string }>
  }

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ error: 'No reviews provided' }, { status: 400 })
  }

  // Format reviews for the prompt — cap at 60 to stay within context limits
  const sample = reviews.slice(0, 60)
  const reviewsText = sample
    .map((r, i) => `[${i + 1}] ★${r.rating} (${r.date.substring(0, 7)}) [${r.category ?? 'uncategorized'}]\n${r.text ?? '(no text)'}`)
    .join('\n\n')

  const prompt = `You are analyzing Amazon customer reviews to surface specific, actionable complaint patterns.

Product: ${productName} (ASIN: ${asin})
Reviewing ${sample.length} most recent negative reviews (1–3 stars).

REVIEWS:
${reviewsText}

TASK: Identify the top 3–5 SPECIFIC complaint themes. Be concrete — avoid vague labels like "quality issues."

Good theme titles: "Battery fails within 6 months", "Buckle/clasp breaks after light use", "Assembly instructions missing key steps"
Bad theme titles: "Quality problems", "Design issues" (too vague)

For each theme:
1. Short specific title (5–10 words)
2. Severity: high (core function broken), medium (significant inconvenience), low (minor annoyance)
3. Approximate count of reviews mentioning it
4. 1–2 sentence description
5. 2–3 short verbatim quotes (keep under 100 chars each)

Return ONLY valid JSON — no markdown, no explanation:
{
  "themes": [
    {
      "title": "...",
      "severity": "high|medium|low",
      "count": N,
      "summary": "...",
      "quotes": ["...", "..."]
    }
  ]
}`

  const isOpenRouter = !!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY
  const url = isOpenRouter
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.anthropic.com/v1/messages'

  let responseJson: string

  if (isOpenRouter) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await resp.json()
    responseJson = data?.choices?.[0]?.message?.content ?? '{}'
  } else {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await resp.json()
    responseJson = data?.content?.[0]?.text ?? '{}'
  }

  try {
    // Strip possible markdown code fences
    const clean = responseJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: responseJson }, { status: 500 })
  }
}
