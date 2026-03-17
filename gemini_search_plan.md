# Free Text Search with Gemini API

## Concept

A search bar on the dashboard where users type natural language queries in Hebrew or English (e.g., "?האם הדיור מתייקר מהר מהשכר" or "what's the real mortgage rate right now"). Gemini analyzes the cached macro data and streams an analytical response in real time.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Client (search bar)                                │
│  POST /api/search { query: "..." }                  │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  /api/search/route.ts                               │
│  1. Load BOI + CBS from blob cache (no new fetches) │
│  2. Build compact context snapshot                  │
│  3. Call Gemini streaming API                       │
│  4. Pipe ReadableStream back to client              │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  Gemini API  (gemini-2.5-flash, streaming)          │
│  System: macro analyst for Israeli economy          │
│  Context: latest values + 12-month trends           │
│  Output: streamed analysis text                     │
└─────────────────────────────────────────────────────┘
```

## New Files

| File | Purpose |
|------|---------|
| `src/lib/gemini.ts` | Gemini client, context builder, streaming helper |
| `src/app/api/search/route.ts` | POST endpoint — builds context, calls Gemini, streams response |

Plus edits to `cbs-dashboard-app.tsx` for the search UI.

## 1. Context Builder (`gemini.ts`)

The key insight: we already have all the data cached in `.blob-cache/`. No extra BOI/CBS calls needed — just read the cache and compress it into a prompt.

Context format sent to Gemini:

```
## מצב מאקרו נוכחי (נכון ל-{date})

### מוניטרי ומחירים
| מדד | ערך אחרון | תאריך | שינוי 3 חודשים | שינוי שנתי |
| ריבית בנק ישראל | 4.50% | 03/2026 | — | -0.25% |
| שינוי מדד המחירים | 0.3% | 02/2026 | +0.8% | +3.1% |
| ציפיות אינפלציה | 2.8% | 02/2026 | +0.2% | -0.1% |
| מדד שכר דירה | 108.2 | 02/2026 | +1.1% | +4.2% |
...

### צמיחה ותעסוקה
...

### דיור ומימון
...

### מגזר חיצוני ושוק ההון
...

## נתונים היסטוריים (12 חודשים אחרונים)
{compact CSV — ~30 rows x 5 columns per series}
```

Context builder logic:

```typescript
export async function buildMacroContext(): Promise<string> {
  // Read from blob cache (already JSON on disk)
  const boi = readBoiCache();   // BoiDashboardSummary
  const cbs = readCbsCache();   // DashboardSummary

  // For each series: latest value, 3-month delta, 12-month delta
  // Compress into markdown table (~3-4KB total)
  // Include last 12 data points per series as compact CSV
}
```

Total context size: ~5-8KB of text — well within Gemini's context window and cheap to process.

## 2. Gemini Streaming (`gemini.ts`)

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are a macro-economic analyst specializing in the Israeli economy.
You have access to real-time data from Bank of Israel and CBS.
Rules:
- Answer in the same language as the query (Hebrew or English)
- Be concise, data-driven, reference specific values
- When relevant, mention trends, comparisons, and derived ratios
- Do not invent data — only use what is provided in the context
- Format with markdown for readability`;

export async function streamSearch(query: string, context: string) {
  return ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: `${context}\n\n---\nשאלת המשתמש: ${query}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
    },
  });
}
```

## 3. API Route (`/api/search/route.ts`)

```typescript
export async function POST(request: Request) {
  const { query } = await request.json();
  const context = await buildMacroContext();
  const geminiStream = await streamSearch(query, context);

  // Convert Gemini async iterator -> ReadableStream for Next.js
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of geminiStream) {
        controller.enqueue(new TextEncoder().encode(chunk.text));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
```

## 4. Client UI (component update)

```
┌──────────────────────────────────────────────────────┐
│  מה קורה עם יחס מחיר-שכירות?                 [חפש] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  מדד מחירי הדירות עלה ב-4.2% בשנה האחרונה, בעוד    │
│  מדד שכר הדירה עלה רק ב-2.8%. הפער מעיד על...      │
│  (streaming cursor)                                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- Search bar positioned below the BOI hero section (or global, above both views)
- Streaming response rendered as markdown
- Loading state: pulsing cursor
- Error state: retry button

Client streaming reader:

```typescript
const res = await fetch("/api/search", {
  method: "POST",
  body: JSON.stringify({ query }),
});

const reader = res.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  setText(prev => prev + decoder.decode(value));
}
```

## 5. Environment and Dependencies

```bash
npm install @google/genai
```

One env var: `GEMINI_API_KEY`

## 6. Cost and Performance

| Factor | Value |
|--------|-------|
| Model | gemini-2.5-flash |
| Context size | ~5-8KB (~2K tokens) |
| Avg response | ~500-1000 tokens |
| Cost per query | ~$0.0003 |
| Time to first token | ~300-500ms |
| Full response | ~2-4 seconds streamed |
| Extra BOI/CBS calls | Zero (reads blob cache) |

## Implementation Phases

### Phase 1 — MVP

- `@google/genai` dependency
- `src/lib/gemini.ts` — context builder + streaming client
- `src/app/api/search/route.ts` — POST streaming endpoint
- Search bar + response panel in the dashboard component
- Works across BOI and CBS data

### Phase 2 — Smart References

- Gemini returns structured JSON: `{ analysis, referencedSeries[], insight }`
- Client auto-scrolls to / highlights referenced charts
- Suggested follow-up questions

### Phase 3 — Conversational

- Multi-turn: chat history maintained in client state
- Send previous Q&A as conversation context
- "Ask a follow-up" UX
