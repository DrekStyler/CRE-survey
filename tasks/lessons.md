# Lessons Learned

## shadcn/ui v4 + base-ui

- shadcn/ui now uses `@base-ui/react` instead of Radix for some components (like Select)
- The `Select` component's `onValueChange` callback signature is `(value: string | null, eventDetails) => void`, not just `(value: string) => void`
- When types don't align, fall back to native HTML elements rather than fighting the component library
- Always check actual component source in `src/components/ui/` before assuming API matches docs

## Zod + React Hook Form

- `z.coerce.number()` and `z.preprocess()` both produce `unknown` output types that don't play well with `@hookform/resolvers`
- For form inputs that need type conversion (e.g., string -> number), handle the conversion in `onSubmit` and keep the Zod schema using the final type (`z.number()`)

## Clerk v6+

- `UserButton` no longer accepts `afterSignOutUrl` prop directly
- Use Clerk's environment variable `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL` instead

## Drizzle JSONB

- JSONB columns are typed as `unknown` in Drizzle's inferred types
- Must cast explicitly when using in React: `driver.supportingEvidence as SupportingEvidence[]`
- When rendering JSONB values in JSX, use ternary (`condition ? <jsx/> : null`) not short-circuit (`condition && <jsx/>`), because `unknown && <jsx/>` confuses TypeScript's type narrowing for ReactNode

## Next.js 16 / Node 24

- Node 24 can have module resolution issues with `node_modules/.bin` symlinks
- If `npx tsc` or `npx next build` fails with `Cannot find module`, try `rm -rf node_modules && npm install`

## AI Prompt Engineering (Scenario Projections)

- When AI models financial projections, it will default to flat/linear growth unless explicitly told otherwise. A CFO expects Year 1 ramp-up costs (setup, furniture, IT buildout) and ramping revenue (partial occupancy). Always model realistic cost curves, not steady-state from day one.
- Employee count for retail/restaurant/hospitality companies = total workforce (incl. store workers). Must explicitly tell AI to estimate corporate/office headcount (1-5% of total).
- "100% headcount growth" from broker interviews is company-wide over years, not one office doubling. Prompt must instruct AI to apply conservatively (3-8% annual).
- When AI bundles multiple financial concepts into one field (e.g., "cost" = rent + opex + buildout), break them apart for transparency. Use optional fields for backward compat with stored data.
- Always normalize AI output server-side (enforce `cost = leaseCost + operationalCost`, `netProfit = revenue - cost`) — don't trust the AI to get arithmetic right.
- Scope matters: AI will model entire corporate portfolio unless explicitly told "this is ONE office location" with sqft guardrails (30K-200K for major companies).

## Backward-Compatible JSON Schema Evolution

- When evolving a JSON blob stored in a TEXT column, use optional fields (`leaseCost?: number`) rather than breaking changes. Old data parses fine, chart uses `hasBreakdown` flag to conditionally render new vs legacy UI.
- For major structural changes (single → multi-location), use a version discriminator pattern (`version: 2` field) with a union type (`StoredProjectionData = SingleLocation | MultiLocation`).
- `normalizeToLocations()` pattern: wrap legacy single-location data in a single-element array so the rest of the code only deals with one shape.
