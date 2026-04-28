# Email Deliverability Audit — AIM Platform

## Current Architecture

| Layer | Transport | Use Case |
|-------|-----------|----------|
| **Microsoft Graph** | `sendViaGraph()` | Member emails (auth, announcements, status changes) |
| **Azure Communication Services** | `sendViaACS()` | Subscriber/newsletter emails (bulk) |
| **SMTP** (optional) | `sendViaSMTP()` | Fallback if admin configures |

Sender: `aimstudio@impactaistudio.com` via Graph

---

## ✅ What You Already Have (Strong Foundation)

| Requirement | Status | Where |
|---|---|---|
| Bounce classification engine | ✅ | `suppression.ts` — hard/soft/complaint/throttle |
| Auto-suppression on hard bounce | ✅ | 1 hard bounce → permanent |
| Soft bounce threshold | ✅ | 3 within 7 days → temp suppress |
| Complaint auto-suppress | ✅ | Immediate permanent |
| List-Unsubscribe headers | ✅ (fixed today) | `mailer.ts` — X-prefixed for Graph |
| One-click unsubscribe endpoint | ✅ | `/api/unsubscribe` |
| Tracking pixel for open rates | ✅ | Injected by `sendEmail()` |
| Suppression pre-check on send | ✅ | Every `sendEmail()` + `sendBulkEmail()` |
| Health score dashboard | ✅ | `computeHealthScore()` |
| Rate limiting per domain | ✅ | `domainRateLimiter` |
| Queue-based bulk sends | ✅ | `EmailQueue` + cron worker |
| Throttle-aware retry | ✅ | Graph 429 → Retry-After delay |
| Subscriber dedup before broadcast | ✅ | `enqueueBroadcastCampaign()` |
| Auto-purge old logs | ✅ | Configurable retention days |

---

## ❌ Gaps That Cause Delivery Failures

### 1. 🔴 Sender Domain Separation (CRITICAL)

> [!CAUTION]
> **Microsoft explicitly warns**: _"Avoid using addresses in your primary email domain for bulk email. Consider using a custom subdomain exclusively for bulk email."_

**Current**: All emails (auth + bulk) come from `aimstudio@impactaistudio.com`

**Risk**: If ONE bulk campaign triggers spam complaints, it poisons the reputation of `impactaistudio.com` for ALL emails — including password resets, login codes, and casting notifications.

**Fix (DNS + Azure)**:
```
Transactional: noreply@impactaistudio.com     (password reset, OTP, welcome)
Marketing:     hello@mail.impactaistudio.com   (announcements, newsletters)
Bulk/ACS:      news@mail.impactaistudio.com    (subscriber broadcasts)
```

You need to:
1. Create `mail.impactaistudio.com` subdomain in DNS
2. Add SPF, DKIM, DMARC records for the subdomain
3. Verify it in Azure Communication Services
4. Update `getMailConfig()` to return different `fromEmail` based on email type

---

### 2. 🔴 Missing SPF/DKIM/DMARC Verification

> [!CAUTION]
> **Microsoft**: _"Configure any custom subdomains with email authentication records in DNS (SPF, DKIM, and DMARC). Many email service providers are configured to reject messages that don't meet email authentication standards."_

**Action items** — verify these DNS records exist for `impactaistudio.com`:

```dns
# SPF — authorize Microsoft to send on your behalf
impactaistudio.com    TXT    "v=spf1 include:spf.protection.outlook.com include:communication.azure.com -all"

# DKIM — Microsoft 365 auto-signs, but you need CNAME selectors
selector1._domainkey  CNAME  selector1-impactaistudio-com._domainkey.impactaistudio.onmicrosoft.com
selector2._domainkey  CNAME  selector2-impactaistudio-com._domainkey.impactaistudio.onmicrosoft.com

# DMARC — policy + reporting
_dmarc.impactaistudio.com  TXT  "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@impactaistudio.com; ruf=mailto:dmarc@impactaistudio.com; fo=1"
```

> [!IMPORTANT]
> **How to verify**: Run `nslookup -type=txt impactaistudio.com` and `nslookup -type=txt _dmarc.impactaistudio.com` to check.
> You can also use [MXToolbox](https://mxtoolbox.com/spf.aspx) or [Google Admin Toolbox](https://toolbox.googleapps.com/apps/checkmx/).

---

### 3. 🟡 No Plain Text Multipart (HIGH)

**Current**: All emails are HTML-only. No `text` field is ever populated.

**Risk**: 
- Spam filters score HTML-only emails higher (suspicious)
- Accessibility readers can't parse HTML-only
- Gmail's "This message seems dangerous" warning triggers more often

**Fix**: Generate a plain text version alongside HTML for every email. This is a one-line addition per template call:

```typescript
// In mailer.ts sendViaGraph — add plainText body
body: { 
    contentType: 'HTML', 
    content: options.html 
},
// Should become:
body: options.text 
    ? { contentType: 'HTML', content: options.html }  // Graph sends multipart when both exist
    : { contentType: 'HTML', content: options.html },
```

Better approach — auto-strip HTML tags for plain text:
```typescript
function htmlToPlainText(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim()
}
```

---

### 4. 🟡 InvalidInternetMessageHeader on Graph (FIXED TODAY)

**Was**: `List-Unsubscribe` header rejected by Graph API → **all Graph emails with unsubscribe headers were failing**.

**Fix applied**: Headers now remapped to `X-List-Unsubscribe` etc.

> [!NOTE]
> Gmail and Yahoo still honour `X-List-Unsubscribe` for one-click unsubscribe. This is a known workaround for Graph API limitations.

---

### 5. 🟡 No BIMI Record (MEDIUM)

**BIMI** (Brand Indicators for Message Identification) shows your logo next to emails in Gmail, Yahoo, Apple Mail. Dramatically improves trust and open rates.

```dns
default._bimi.impactaistudio.com  TXT  "v=BIMI1; l=https://impactaistudio.com/bimi-logo.svg"
```

Requirements:
- SVG logo in Tiny PS format
- DMARC policy must be `p=quarantine` or `p=reject`
- Optional: VMC certificate for Gmail verified checkmark (~$1500/yr)

---

### 6. 🟡 Dead Address Cleanup (MEDIUM)

> [!WARNING]
> **Microsoft**: _"Eliminate incorrect and non-existent email aliases from your databases. Any email alias rejected in a bounce message is unnecessary and poses a risk to your outbound email."_

**Current**: Hard-bounced addresses are suppressed (good) but **remain in the Subscriber table**. They inflate your list count and add noise to the admin dashboard.

**You already have** `purgeAllSuppressedSubscribers()` — but it's not exposed in the admin UI for periodic cleanup. Consider adding a "Purge Dead Addresses" button or auto-purging hard bounces after 30 days.

---

### 7. 🟢 Graph Sending Limits Awareness (LOW)

Microsoft 365 limits:
| Limit | Value |
|---|---|
| Recipients per message | 500 |
| Messages per day | 10,000 |
| Recipients per day | 10,000 |
| Messages per minute | 30 |

**Current**: Your `BATCH_SIZE=4` + `BATCH_DELAY_MS=2000` = ~120/min max throughput — well under limits. ✅

---

### 8. 🟢 Feedback Loop Registration (LOW)

> [!TIP]
> **Microsoft**: _"Many email services like Outlook.com, Yahoo, and AOL provide a feedback loop"_

Register for feedback loops with major providers:
- [Microsoft SNDS](https://sendersupport.olc.protection.outlook.com/snds/) — sender reputation data
- [Gmail Postmaster Tools](https://postmaster.google.com/) — domain reputation + spam rate
- [Yahoo CFL](https://help.yahoo.com/kb/postmaster) — complaint feedback loop

These give you real-time visibility into how mailbox providers perceive your domain.

---

## Priority Action Plan

| # | Action | Impact | Effort | 
|---|--------|--------|--------|
| 1 | **Verify SPF/DKIM/DMARC** records exist | 🔴 Critical | 30 min (DNS) |
| 2 | **Create `mail.` subdomain** for marketing | 🔴 Critical | 1 hour (DNS + Azure) |
| 3 | **Add plain text multipart** to all emails | 🟡 High | 1 hour (code) |
| 4 | **Register Google Postmaster** + Microsoft SNDS | 🟡 High | 15 min |
| 5 | **Expose "Purge Dead"** in admin UI | 🟡 Medium | 30 min (code) |
| 6 | **Set up BIMI record** | 🟢 Nice | 1 hour |
| 7 | **Set DMARC to reject** (after monitoring) | 🟢 Nice | 5 min (DNS) |

---

## Quick DNS Diagnostic

Run these commands to check your current email authentication:

```powershell
# Check SPF
nslookup -type=txt impactaistudio.com

# Check DKIM selectors
nslookup -type=cname selector1._domainkey.impactaistudio.com

# Check DMARC
nslookup -type=txt _dmarc.impactaistudio.com

# Check MX
nslookup -type=mx impactaistudio.com
```

> [!IMPORTANT]
> **Start with #1** — if SPF/DKIM/DMARC are misconfigured, no other fix matters. Gmail, Yahoo, and Outlook will reject or spam-folder everything regardless of content quality.
