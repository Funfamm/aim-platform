# AIM Studio — Translation Engine

> **Last updated:** April 2026  
> **Scope:** All content types that support multilingual delivery — Casting Calls, Script Calls, Notification titles/messages, and Email subjects.

---

## Architecture Overview

The translation engine is a **server-side, on-demand pipeline** built on Google Generative AI (`gemini-2.0-flash`). It is intentionally stateless — translations are stored as a serialized JSON blob in the database alongside the source record (not in a separate table). This keeps schema migration cost low and prevents N+1 translation fetches.

```
Admin creates/updates content
        │
        ▼
POST /api/admin/casting/:id/translate
POST /api/script-calls/:id/translate
        │
        ▼
lib/translate.ts → generateContent(Gemini)
        │
        ▼
JSON blob saved to castingCall.translations | scriptCall.contentTranslations
        │
        ▼
Server component reads blob → injects per-locale strings at render time
```

---

## Supported Locales

| Code | Language | Flag |
|------|----------|------|
| `en` | English *(source)* | 🇺🇸 |
| `ar` | Arabic | 🇸🇦 |
| `de` | German | 🇩🇪 |
| `es` | Spanish | 🇪🇸 |
| `fr` | French | 🇫🇷 |
| `hi` | Hindi | 🇮🇳 |
| `ja` | Japanese | 🇯🇵 |
| `ko` | Korean | 🇰🇷 |
| `pt` | Portuguese | 🇵🇹 |
| `ru` | Russian | 🇷🇺 |
| `zh` | Chinese (Simplified) | 🇨🇳 |

---

## Per-Content-Type Details

### Casting Calls (`castingCall.translations`)

**Fields translated:** `roleName`, `roleDescription`

**Trigger points:**
1. `POST /api/admin/casting` — auto-translated on creation if status is `open`  
2. `POST /api/admin/casting/:id/translate` — manual re-translate button in admin edit modal  
3. `TranslationBadge` + Re-translate in casting card action row (calls endpoint above)

**Storage format:**
```json
{
  "ar": { "roleName": "المحقق كروس", "roleDescription": "محقق صارم..." },
  "de": { "roleName": "Detektiv Cross", "roleDescription": "Ein unnachgiebiger..." },
  ...
}
```

**Runtime injection** (`apply/page.tsx`):
```typescript
const tr = locale === 'en' ? null : JSON.parse(castingCall.translations)?.[locale]
const castingCallForForm = {
  ...castingCall,
  roleName: tr?.roleName || castingCall.roleName,
  roleDescription: tr?.roleDescription || castingCall.roleDescription,
}
```

---

### Script Calls (`scriptCall.contentTranslations`)

**Fields translated:** `title`, `description`

**Trigger points:**
1. `POST /api/script-calls` — auto-translated on creation when `isPublic: true`  
2. `POST /api/script-calls/:id/translate` — manual re-translate button in admin edit modal

**Storage format:**
```json
{
  "fr": { "title": "Appel à scénarios", "description": "Nous recherchons..." },
  ...
}
```

---

### Notification Titles & Messages (`notifyNewRole`)

Broadcasting a new casting role to all subscribed users uses **pre-built static i18n** from `lib/email-i18n.ts` (no runtime Gemini call). This avoids API cost for bulk notification sends.

```typescript
// notifications.ts — notifyNewRole()
for (const loc of LOCALES) {
  translations[loc] = {
    title:   t('castingNewRole', loc, 'notifTitle').replace('{role}', roleName),
    message: t('castingNewRole', loc, 'notifMessage').replace('{role}', roleName),
    link: `${siteUrl}/${loc}/casting/${roleId}`,
  }
}
```

For `new_role` email rebuilds, `opts.roleName` is threaded through `NotifyUserOptions` → `broadcastNotification` → `notifyUser` to avoid brittle title-stripping across locales.

---

### Email Subjects & Bodies (`lib/email-i18n.ts`)

**Source of truth** for all transactional email copy. The `t(key, locale, field)` helper performs locale-priority resolution:

```
requested locale → 'en' fallback → empty string
```

**Supported keys:**
- `contactAcknowledgment` — Contact form auto-reply  
- `castingNewRole` — New casting call notification  
- `applicationStatusUpdate` — Application status change (accepted/declined/waitlisted)  
- `auditResultReveal` — AI audit reveal notification  
- `scriptStatusUpdate` — Script submission status change  
- `announcement` — Platform announcements

> **Encoding rule:** Always write `email-i18n.ts` with `[System.IO.File]::WriteAllText` and explicit `UTF8NoBOM` encoding. **Never** use PowerShell `Set-Content`, which adds a BOM and corrupts next-intl locale parsing.

---

## Translation Coverage Badge

The `TranslationBadge` component renders inline on every admin list card:

```tsx
<TranslationBadge translationsJson={call.translations} retry={{ type: 'casting', id: call.id }} />
```

It parses the JSON blob and displays:
- 🟢 `11/11` — all locales covered  
- 🟡 `7/11` — partial coverage  
- 🔴 `0/11` — no translations

Clicking "Re-translate" calls the appropriate `/translate` endpoint and refreshes the list.

---

## Admin Translation Panel (Edit Modals)

Both casting and script edit modals include a collapsible **Translations Preview Panel** that shows:
1. Coverage count badge (`N/10 langs`)
2. Per-language card showing `roleName` or `title` preview (or "Not translated")
3. **Re-translate** button — triggers the translate POST endpoint and refreshes the list

This is the primary in-context tool for admins to verify and re-generate translations without leaving the edit flow.

---

## Error Handling & Timeouts

```typescript
// lib/translate.ts — translateContent()
const result = await Promise.race([
  model.generateContent(prompt),
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15_000))
])
```

- **Timeout:** 15 seconds per translation batch  
- **Parse failure:** Returns `null` — original English content is used as fallback  
- **Broadcast timeout:** `notifyAnnouncement()` has a separate 10-second guard; times out to English-only broadcast with a warn log

---

## Adding a New Translatable Field

1. Add the field name to the Gemini prompt in `lib/translate.ts`
2. Add the field to the JSON schema hint in the prompt
3. Update the runtime injection in the server component to read `tr?.newField || source.newField`
4. Update `TranslationBadge`'s coverage check if the field is the primary coverage indicator
