# Migration & Client Generation Plan

**Goal**: Apply the new `country` and `ownerId` fields to the `Project` model, generate the updated Prisma client, and ensure the About page displays live statistics without type errors.

## Proposed Changes

### 1. Database Migration
- Run `npx prisma migrate dev --name add_country_owner_fields` to create a migration that adds the nullable `country` (String) and `ownerId` (String) columns and the relation to `User`.
- This migration is safe (adds nullable columns) and will not require data loss.

### 2. Prisma Client Regeneration
- After the migration, run `npx prisma generate` to update the generated client types so that `prisma.project.findMany` can select `country` and `ownerId`.

### 3. Verify TypeScript Compilation
- Restart the dev server (`npm run dev`).
- Ensure the project builds without TypeScript errors related to `country` or `ownerId`.

### 4. Manual Verification of Live Stats
- Open the About page in the browser.
- Confirm that the stats grid shows real numbers (productions count, distinct countries, distinct creators, awards placeholder).
- Add a new project via the admin UI with a `country` and verify the stats increment after the ISR revalidation interval.

## Open Questions
- None. All steps are straightforward and safe.

## Verification Plan
### Automated Checks
- Run `npm run lint` and `npm run build` to ensure no TypeScript errors.
- Use the browser to load `/about` and check that the stats render.

### Manual Checks
- Add a new project with a country and owner, then observe the updated stats after ISR.

[ignoring loop detection]
