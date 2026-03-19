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

## Phased Rollout

### Phase 1 — Backend Foundation

Goal:

- Make the server capable of answering one search query from cached macro data.

Scope:

- Add `@google/genai`
- Add `GEMINI_API_KEY`
- Create `src/lib/gemini.ts`
- Create `src/app/api/search/route.ts`
- Read BOI + CBS from `.blob-cache/` only
- Stream plain-text responses back to the client

Context builder:

The key insight is that we already have BOI and CBS artifacts cached locally. The first phase should only compress that cached data into a prompt and avoid any new BOI/CBS fetch path.

Context format:

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

Reference implementation:

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

Streaming implementation:

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

Route shape:

```typescript
export async function POST(request: Request) {
  const { query } = await request.json();
  const context = await buildMacroContext();
  const geminiStream = await streamSearch(query, context);

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

Exit criteria:

- `POST /api/search` accepts one query and returns a streamed answer
- Works with cached BOI + CBS data only
- No extra source fetches

### Phase 2 — Dashboard UI

Goal:

- Expose the backend through a usable search UI inside the dashboard.

Scope:

- Add a search bar to `cbs-dashboard-app.tsx`
- Add a response panel below it
- Render streaming text progressively
- Add loading and error states

Target UI:

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

UI behavior:

- Search bar positioned below the BOI hero section or as a global search module
- Streaming response rendered as markdown
- Loading state shows partial streamed text and cursor
- Error state includes retry

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
  setText((prev) => prev + decoder.decode(value));
}
```

Exit criteria:

- User can ask one question from the dashboard
- Response appears incrementally without full-page reload
- Failure state is understandable and retryable

### Phase 3 — Smart References

Goal:

- Make answers map back to charts and series already on screen.

Scope:

- Gemini returns structured output such as:

```json
{
  "analysis": "...",
  "referencedSeries": ["policy_rate", "housing_credit_total"],
  "insight": "..."
}
```

- Client highlights or scrolls to referenced charts
- Add suggested follow-up questions under the response

Exit criteria:

- Search results can point users back to specific BOI/CBS charts
- Follow-up suggestions are generated from the same answer payload

### Phase 4 — Conversational Layer

Goal:

- Turn one-off search into a follow-up workflow.

Scope:

- Keep chat history in client state
- Send previous turns as trimmed conversation context
- Support "ask a follow-up" instead of starting over

Exit criteria:

- User can ask a second question that depends on the first answer
- The app preserves enough context to stay coherent without bloating the prompt

## Environment and Dependencies

```bash
npm install @google/genai
```

Required env var:

- `GEMINI_API_KEY`

## Cost and Performance

| Factor | Value |
|--------|-------|
| Model | gemini-2.5-flash |
| Context size | ~5-8KB (~2K tokens) |
| Avg response | ~500-1000 tokens |
| Cost per query | ~$0.0003 |
| Time to first token | ~300-500ms |
| Full response | ~2-4 seconds streamed |
| Extra BOI/CBS calls | Zero (reads blob cache) |

## Recommended Build Order

1. Phase 1 first, because it proves the cached-data prompt and streaming route.
2. Phase 2 next, because it makes the feature usable in the dashboard.
3. Phase 3 after that, because references depend on the base answer format being stable.
4. Phase 4 last, because conversation should be added only after single-turn quality is solid.
