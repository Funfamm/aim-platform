# DEPLOYMENT.md – AIM Platform (Free Tier Stack)

## Stack
| Component | Service | Cost |
|-----------|---------|------|
| Frontend/SSR | **Vercel** (free hobby plan) | $0 |
| Database | **Neon PostgreSQL** (free tier) | $0 |
| Video Storage | **Cloudflare R2** (10 GB free) | $0 |
| Monitoring | **Sentry** (free tier) | $0 |

---

## Step 1 – Set Up the Free Database (Neon)

1. Go to [https://console.neon.tech](https://console.neon.tech) and create a free account.
2. Create a new project (e.g. `aim-platform`). Neon provides two connection strings:
   - **Pooled URL** → use for `DATABASE_URL`
   - **Direct URL** → use for `DIRECT_URL`
3. Copy both strings and add them to your environment variables (Vercel dashboard or `.env.local` locally).

```env
DATABASE_URL="postgresql://<user>:<password>@<host>.neon.tech/<db>?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<host>.neon.tech/<db>?sslmode=require"
```

4. Run the initial migration to create all tables:

```bash
npx prisma migrate deploy
```

5. Seed the super-admin:

```bash
npm run prisma:seed
```

---

## Step 2 – Set Up Video Storage (Cloudflare R2)

1. Log in to [https://dash.cloudflare.com](https://dash.cloudflare.com).
2. Go to **R2 Object Storage** → **Create bucket** → name it `aim-platform-videos`.
3. (Optional) Enable **public access** on the bucket to get a free public URL:  
   `https://pub-<hash>.r2.dev` — if you enable this, set `R2_PUBLIC_URL` and skip signing.
4. Go to **Manage R2 API Tokens** → create a token with **Object Read & Write** permission.
5. Copy the token details and add them to your env vars:

```env
R2_ACCOUNT_ID="<your Cloudflare account ID>"
R2_ACCESS_KEY_ID="<token access key>"
R2_SECRET_ACCESS_KEY="<token secret>"
R2_BUCKET_NAME="aim-platform-videos"
R2_PUBLIC_URL="https://pub-<hash>.r2.dev"   # optional
```

6. Upload your movie files to the R2 bucket. Use the object key as the video path stored in the DB (e.g. `movies/my-film.mp4`).
7. In your app, call `resolveVideoUrl(project.filmUrl)` from `src/lib/videoStorage.ts` to get a signed (or public) URL for the `<video>` tag.

---

## Step 3 – Deploy to Vercel

1. Push the project to GitHub (if not already):

```bash
git add .
git commit -m "chore: production deployment setup"
git push origin main
```

2. Go to [https://vercel.com](https://vercel.com) → **Add New Project** → import the GitHub repo.
3. Framework preset: **Next.js** (auto-detected).
4. In **Environment Variables**, add every variable from `.env.example` with their production values.
5. Click **Deploy**.
6. After the first deploy, go to **Settings → Environment Variables** and update `NEXT_PUBLIC_SITE_URL` to your Vercel domain (e.g. `https://aim-platform.vercel.app`), then redeploy.

---

## Step 4 – Post-Deploy Verification Checklist

- [ ] Home page loads without errors.
- [ ] Login / register flow works (JWT is set correctly).
- [ ] Sponsor page renders data from PostgreSQL.
- [ ] Movie player loads and a signed R2 URL is resolved for `<video src>`.
- [ ] Admin panel (`/admin`) is accessible with the seeded super-admin account.
- [ ] Sentry dashboard receives at least one event (visit `/api/test-sentry` if set up).

---

## Updating Environment Variables Later

1. Vercel dashboard → **Project Settings → Environment Variables** → edit a value → **Save**.
2. Trigger a new deployment (Vercel auto-deploys on each push, or click **Redeploy**).

## Running Migrations After Schema Changes

```bash
# Locally (generates migration files)
npx prisma migrate dev --name <description>

# On production DB (CI or manual)
npx prisma migrate deploy
```

## Rolling Back

Vercel keeps every deployment. Go to **Deployments** → click a previous build → **Promote to Production**.
