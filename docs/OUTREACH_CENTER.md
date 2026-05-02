# Outreach Center — Admin Guide

> Unified hub for composing and sending announcements, surveys, and campaigns.

---

## Overview

The Outreach Center (`/admin/outreach`) consolidates the platform's communication tools into a single admin interface with three tabs:

| Tab | Purpose |
|-----|---------|
| **📝 Compose** | Create and send announcements, surveys, or campaigns |
| **📊 Survey Results** | View all 12 survey analytics sections, moderate comments, export CSV |
| **📜 History** | Browse all past outreach with pagination and type filtering |

---

## Compose Workflow

### 1. Choose Outreach Type

| Type | Description | CTA Behavior |
|------|-------------|--------------|
| 📣 **Announcement** | News broadcast + in-app notification | No CTA button |
| 📊 **Survey** | Survey invitation | Auto-generated CTA → `/survey` |
| 📧 **Campaign** | Custom email with editable CTA | Manual CTA text + URL + color |

### 2. Fill Out Content

- **Title** — Required. Used as email subject.
- **Summary / Message** — Required. Main body text.
- **Rich Text Body** — Optional. HTML content rendered in email.
- **Banner Image** — Optional. Upload via the image uploader.
- **Link** — Optional. Additional reference link.

### 3. Configure CTA (Campaign / Survey only)

- **Button Text** — e.g., "Watch Now →"
- **Button URL** — Must start with `/` (relative) or `https://` (absolute). Anything else is rejected for XSS prevention.
- **Button Color** — Choose from 5 preset color swatches (Gold, Green, Blue, Purple, Red).

### 4. Select Audience

- **👥 Members** — Registered platform users
- **📬 Subscribers** — Newsletter subscribers
- **🎭 Cast** — Cast members
- **🎯 Specific Users** — Search by name/email and select individuals

The recipient count and estimated delivery time are shown in real-time.

### 5. AI Translation

If your audience includes users with non-English locale preferences, the system detects needed languages and offers one-click AI translation. Translations are reviewed inline before sending.

### 6. Test Send

Enter an email address and click **Send Test** to queue a single preview email.

> **Rate Limit:** Max 5 test emails per admin per minute. Exceeding this returns a 429 error.

### 7. Send to All

Click **Send to All** to broadcast. A confirmation dialog prevents accidental sends. The draft is cleared from autosave after a successful send.

---

## Draft Autosave

All compose fields are automatically saved to `localStorage` with a 1-second debounce. When you return to the Compose tab, your draft is restored.

- **Tab switch guard:** If you try to switch away from Compose while you have unsaved content, a confirmation dialog appears.
- **Browser navigation guard:** Closing or refreshing the page with unsaved content triggers the browser's native "leave page?" prompt.
- **Clear on send:** After a successful send, the draft is removed from storage.

---

## History Tab

### Pagination

History items are loaded 30 per page via server-side pagination. Use the ◀/▶ buttons to navigate pages.

### Type Filtering

Filter by type using the pill buttons:

| Filter | Shows |
|--------|-------|
| All | Everything |
| 📣 Announcements | Announcement-type entries only |
| 📊 Surveys | Survey-type entries only |
| 📧 Campaigns | Campaign-type entries only |

### Error Handling

If the history fetch fails, a "⚠️ Failed to load history" message appears with a **🔄 Retry** button.

---

## API Endpoints

### `POST /api/admin/announcements`
Creates and broadcasts outreach. Accepts:
- `title`, `message`, `bodyHtml`, `imageUrl`, `link`
- `type` — `announcement` | `survey` | `campaign`
- `ctaText`, `ctaUrl`, `ctaColor`
- `notifyGroups`, `specificUserIds`, `translations`

### `POST /api/admin/announcements/test`
Queues a single test email. Validates:
- Email format (regex)
- Required fields (`testEmail`, `title`, `message`)
- CTA URL format (relative or HTTPS only)
- Rate limit (5/min/admin)

### `GET /api/admin/announcements`
Returns paginated history. Query params:
- `page` — page number (default 1)
- `type` — optional type filter

---

## URL Redirects

| Legacy URL | Redirects To |
|------------|-------------|
| `/admin/announcements` | `/admin/outreach` |
| `/admin/survey` | `/admin/outreach?tab=results` |

These are permanent redirects — bookmarks will auto-redirect.

---

## Design System

Shared styles are in `src/app/admin/outreach/outreach.css`. Key class names:

| Class | Usage |
|-------|-------|
| `.outreachInput` | All text inputs |
| `.outreachLabel` | Uppercase labels above inputs |
| `.outreachCard` | Section containers |
| `.outreachTabBar` / `.outreachTabBtn` | Page-level tab navigation |
| `.outreachFilterPill` | Type filter buttons in History |
| `.outreachHistoryItem` | History row containers |
| `.outreachTypeBadge` | Type label badges |
| `.outreachBtnPrimary` / `.outreachBtnGhost` | Action buttons |
| `.outreachPagination` / `.outreachPaginationBtn` | Page navigation |
| `.outreachErrorBlock` / `.outreachRetryBtn` | Error state UI |

---

## Security

- **CTA URL validation**: Dual-layer — client-side blocks form submission + server-side returns 400.
- **Admin guard**: All API routes require `requireAdmin()` session.
- **Rate limiting**: In-memory sliding-window limiter on test-send (5/min/admin).
- **XSS prevention**: Only `/` and `https://` URLs accepted; `javascript:`, `data:`, and `http://` are blocked.
