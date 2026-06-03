# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**ХочуКупити** is a Ukrainian reverse-marketplace SPA — buyers post "want to buy" requests and sellers submit price offers. The entire frontend is a single file: `index.html` contains all HTML, CSS, and JavaScript (~1300 lines). There is no build system, no package manager, and no bundler.

## Running the app

Open `index.html` directly in a browser, or serve it as a static file:

```
# Python
python -m http.server 8080

# Node (npx)
npx serve .
```

There is no build step. Changes to `index.html` take effect on reload.

## Deployment

Deployed to Netlify. Config is in `netify.toml` (note the intentional filename typo — do not rename it). The file sets a permissive CSP header for `/*`.

## Architecture

### Frontend (`index.html`)

The entire app lives in one file. Page routing is done by showing/hiding `<div>` elements via `showPage(name)`:

| Page element ID | Description |
|---|---|
| `main-page` | Home feed — card grid of buy requests with category chips and search |
| `profile-page` | User profile, stats, edit form, reviews |
| `chat-list-page` | List of all chats |
| `chat-window-page` | Individual chat thread |

Modals (`modal-bg` + `open` class toggle): `request-modal`, `auth-modal`, `new-req-modal`, `confirm-modal`, `review-modal`.

Responsive breakpoint is `701px` — below shows mobile header + bottom nav + FAB; above shows desktop topbar + sidebar.

Deep links work via `?request=<uuid>` query param, handled in `checkUrlRequest()` on init.

Event delegation: all card/button clicks are routed through a single `document.addEventListener('click')` handler that reads `data-action` attributes.

### Backend (Supabase, hosted)

Credentials are hardcoded in `index.html` (publishable anon key — safe to commit):
- `SUPABASE_URL`: `https://dvjmqgzpxpfwuxpjrsdx.supabase.co`
- `SUPABASE_KEY`: publishable key in `config.js` and `index.html`

**Tables:**
- `profiles` — user display data (name, city, bio, avatar_url)
- `requests` — buy requests (title, description, category, budget, photos[], user_id, closed_at)
- `offers` — seller responses (request_id, user_id, description, price, photos[])
- `chats` — chat threads (request_id, buyer_id, seller_id)
- `messages` — chat messages (chat_id, sender_id, text)
- `reviews` — seller ratings (reviewer_id, seller_id, request_id, rating, comment)

**Storage bucket:** `offers-photos` — used for both request photos and offer photos.

**Realtime subscriptions:**
- `public-changes` channel: listens to all `INSERT/UPDATE/DELETE` on `requests` and `offers` → rerenders feed
- `chat-<id>` channel: listens to new `messages` in the open chat window

### Edge function (`supabase/functions/notify-offer/`)

Deno function that fires on new offer inserts. Fetches buyer's email via `auth.admin.getUserById`, then sends a notification email via [Resend](https://resend.com).

Required secrets (set in Supabase dashboard):
- `RESEND_API_KEY`
- `SERVICE_ROLE_KEY`

To deploy the function:
```
supabase functions deploy notify-offer
```

To run Supabase locally:
```
supabase start
supabase functions serve notify-offer
```
