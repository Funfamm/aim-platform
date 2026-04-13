# AIM Studio — Platform Longevity Audit
**Date:** April 2026  
**Status:** Approved for reference — revised roadmap below

---

## Engagement Plan Strengths ✅

| Strength | Why It Matters |
|---|---|
| Reactions + Comments | Creates micro-commitment loops — users who comment are 4× more likely to return |
| XP + Levels | Sunk-cost loyalty — users don't want to abandon a platform where they've invested to reach "Studio Elite" |
| Watch Parties | Synchronized moments — the single most powerful community-building mechanic on any creative platform |
| Localization (11 languages) | You can grow globally without rebuilding — a huge structural advantage most platforms add too late |
| AI audit score | Differentiates AIM from every other casting platform — lean into this harder |

---

## Critical Longevity Gaps ⚠️

### GAP 1 — No Retention Loop for Dormant Users
**The problem:** A user applies, gets rejected, and stops visiting. No mechanism pulls them back.

**What platforms that survive do:**
- **Win-back email sequence:** "You haven't visited in 30 days — here's a new role matching your profile"
- **Personalized weekly digest:** New roles + XP ranking + trending films every Monday
- **Re-engagement nudge:** "Your streak is about to reset — log in to keep it"

Without this, DAU/MAU ratio collapses after the first engagement spike.

**Fix:** Scheduled digest cron job + user preference for digest frequency.

---

### GAP 2 — No Sustainable Monetization Path
**The problem:** Donations alone cannot sustain a growing platform (infrastructure, AI API costs, development).

**What to add — without a hard paywall:**
- **Verified Agency accounts** — talent agencies pay monthly for verified badge + bulk applicant view
- **Premium Talent tier (subscription):**
  - Priority placement in casting search results
  - Direct message to casting directors (inbox unlocked)
  - Portfolio PDF export with AIM watermark
  - Exclusive 24h early-access to new casting calls
- **Sponsorship slots** — production companies pay to be featured casting partners
- **BTS content as a donation perk** — make donations unlock tangible exclusive access

---

### GAP 3 — No Discovery or Recommendation Engine
**The problem:** As the platform grows, browsing breaks. Users churn when they can't find what's relevant.

**What's needed:**
- **Full-text search** across films, roles, courses, announcements (Postgres `tsvector` or Algolia)
- **"Because you watched X" recommendation rows** on works/training pages
- **Role-matching algorithm** — when a role is posted, surface it to users whose profile tags match before they visit
- **Trending section** — most-reacted films, top applied-to roles, trending courses

---

### GAP 4 — No Content Moderation at Scale
**The problem:** The comment system will attract spam and harassment the moment it grows. Unmoderated communities die.

**What's needed:**
- **Auto-moderation:** Flag comments with banned words → hold for review before publishing
- **Community reporting:** Report button → admin moderation queue
- **Comment rate limiting:** Max 5 comments/minute per user
- **Trusted user system:** Users with XP > 500 and zero violations — their reports are weighted higher
- **Admin moderation dashboard:** Review queue with 1-click approve / dismiss / ban

---

### GAP 5 — No Trust & Safety Layer
**The problem:** Real casting calls + real applicants = bad actors appear.

**What's needed:**
- **Verified badge system** — admin-verified casting directors / production companies
- **User blocking** — block a user → they can't view your profile or interact with your content
- **GDPR data export endpoint** `/api/me/export` — legally required for French, German, Spanish users
- **GDPR account deletion** — full right-to-erasure (also legally required in EU)
- **Abuse escalation path** — "Report a user" flow with admin notification

> ⚠️ GDPR compliance is not optional — serving users in France 🇫🇷 Germany 🇩🇪 Spain 🇪🇸 means fines up to 4% of global revenue for non-compliance.

---

### GAP 6 — No SEO Strategy for User-Generated Content
**The problem:** Reactions, comments, profiles, and leaderboards are client-rendered — Google can't index them. The platform is invisible on search for the content that matters most to organic growth.

**What's needed:**
- **Public profiles server-rendered** at `/profile/[username]` — indexed by Google
- **Structured data (JSON-LD)** on films (`Movie`), casting calls (`Event`), and the studio (`Organization`)
- **Server-rendered casting call pages** — imagine Google indexing "Casting call: thriller film London 2026"
- **Auto-generated sitemap** covering all public profiles, films, and casting calls
- **Open Graph tags** on every page so social shares render rich previews

> SEO is the only sustainable free growth channel. Without it, growth is 100% dependent on word-of-mouth and paid promotion.

---

## 5 Structural Enhancements for 5+ Year Longevity

### 1. Personalized Weekly Digest Email
Every Monday — "Your AIM Studio Week": new roles matching your interests, your XP rank, trending films, upcoming watch party date. The highest-ROI retention mechanic that exists for any platform.

### 2. Role-Matching Algorithm
Users tag their profile with role types (`voice actor`, `lead actress`, `stunt performer`). When a casting call posts, it scores similarity against user profiles and proactively notifies matched users with their match percentage.

### 3. Creator Portfolio Showcase
A proper portfolio page per user:
- Showreel link (Vimeo/YouTube embed)
- Previous credits
- AIM training certificates (downloadable PDF)
- XP level + badge showcase
This becomes their industry resume — a permanent reason to keep their profile updated.

### 4. Community Events Calendar
A public `/events` page showing casting deadlines, watch parties, Q&As, training releases, and monthly challenge periods. Users can export to Google Calendar / `.ics`. Creates a recurring reason to visit.

### 5. Admin Intelligence Dashboard
Beyond managing applications, admin needs:
- Retention curves (how long do users stay active post-join?)
- Engagement heatmaps (which content drives the most reactions?)
- Drop-off analysis (where in the application flow do people abandon?)
- Notification effectiveness (which notification type drives the most revisits?)

---

## Revised Sprint Roadmap

| Sprint | Focus | Key Deliverables |
|--------|-------|-----------------|
| **Sprint 5** | Core Engagement | Reactions · Star Ratings · Comments (with moderation) · Extended Bookmarks |
| **Sprint 6** | Discovery & Retention | Full-text search · Weekly digest email · Role-matching algorithm · Trending rows |
| **Sprint 7** | Identity & Trust | Public profiles · XP/Levels · Verified badges · Block/report · GDPR endpoints |
| **Sprint 8** | Monetization & Growth | Premium Talent tier · Agency accounts · SEO (JSON-LD + sitemap + OG) · Events Calendar |
| **Sprint 9** | Community Flagship | Follow/Feed · Leaderboards + Challenges · Live Watch Parties · Admin Intelligence Dashboard |

---

## Longevity Verdict

> The original engagement plan builds a **vibrant community for 6–12 months**.
>
> The full revised roadmap — with retention loops, monetization, moderation, discovery, trust/safety, and SEO — builds a platform designed to grow and sustain for **5+ years**.

The difference: users coming back **because they want to** vs. because there is a system that keeps them engaged, discovered, invested, and legally protected.

---

*Audit prepared: April 2026 | AIM Studio Platform Review*
