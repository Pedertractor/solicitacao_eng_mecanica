---
name: api-error-pt-handler
description: >-
  Create and use a custom API error handler so backend responses always expose
  Portuguese user-facing messages, map HTTP 500 to "erro interno do servidor",
  and let the frontend show messages derived from the backend response. Use when
  adding or changing API errors, HttpError usage, Fastify setErrorHandler,
  axios error interceptors, Portuguese error copy, or 500 handling.
---

# API error handler (Portuguese messages)

## Goal

Guarantee the API always sends a message formatted in Portuguese. Create a
custom handler (do not leave ad-hoc English/`error.message` leaks) and show a
custom message based on the backend response. When the backend returns a 500,
use the message **erro interno do servidor**.

## When applying this skill

Copy this checklist and complete every item:

```
Error handler progress:
- [ ] Custom backend error mapper/handler exists (or is created now)
- [ ] Response shape is always `{ error: string }` with Portuguese text
- [ ] HTTP 500 maps to "erro interno do servidor" (never raw Error.message)
- [ ] HttpError / Zod / middleware paths use Portuguese messages
- [ ] Frontend shows the backend `error` string (with PT fallbacks)
- [ ] No new English user-facing API error strings
```

## 1. Create the custom backend handler (required)

If `back-end/src/https/errors/error-handler.ts` (or equivalent) does not exist,
**create it**. Do not only patch inline strings in `app.ts`.

### Contract

- Shape: `{ error: string }`
- Language: Portuguese only for the `error` field
- Status `500` (and unhandled exceptions): `"erro interno do servidor"`
- Other 5xx via intentional `HttpError` (e.g. 503): keep the Portuguese message
- Log the real error server-side; never send stack traces or raw internal messages to the client

### Required module

Create `back-end/src/https/errors/error-handler.ts` following
[handler-template.md](handler-template.md).

Wire it in `back-end/src/app.ts`:

```ts
import { apiErrorHandler } from './https/errors/error-handler.js';

app.setErrorHandler(apiErrorHandler);
```

Keep Fastify-specific codes (file too large, body too large) inside the custom
handler, still returning Portuguese messages.

### HttpError rule

- `HttpError` messages **must** already be Portuguese when thrown from services,
  controllers, middlewares, and integrations.
- Prefer `throw new HttpError('…', status)` over inline `reply.status().send()`.
- For intentional 500s via `HttpError`, still use `"erro interno do servidor"`
  (or throw without a client-safe detail and let the handler map 500).

## 2. Map messages by backend response (frontend)

Show a custom message based on the backend response:

1. Prefer `error.response.data.error` from the API.
2. If status is `500` (or missing body), show `"erro interno do servidor"`.
3. Keep existing session/network fallbacks in Portuguese.

Central place: `front-end/src/utils/axiosConfig.ts` interceptor (and any shared
`getApiErrorMessage` helper if created).

Rejected client shape should remain `{ message: string, status: number }` so
pages/toasts use `message` from the handler, not `instanceof Error`.

## 3. Portuguese message rules

| Situation | Client message |
|-----------|----------------|
| Unhandled / unexpected 500 | `erro interno do servidor` |
| Business `HttpError` (4xx) | Exact Portuguese message thrown |
| Zod validation | Portuguese issue message (fallback: `Erro de validação`) |
| Network / no response | Existing PT fallback (e.g. connection error) |
| External API failures | Portuguese `HttpError` only — never English templates |

Never introduce English fallbacks such as `"Internal server error"` or
`"Failed to …"` in user-facing API payloads.

## 4. Verification

Before finishing:

1. Confirm unhandled throws return `{ error: "erro interno do servidor" }` with status 500.
2. Confirm a sample `HttpError(404)` still returns its Portuguese `error` string.
3. Confirm the axios interceptor surfaces that string (and 500 uses the PT 500 text).
4. Grep for English error payloads in touched files (`Internal server`, `Failed to`, `Unexpected`).

## Additional resources

- Handler and interceptor templates: [handler-template.md](handler-template.md)
