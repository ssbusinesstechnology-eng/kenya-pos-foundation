# S&S Business Hub

Build "S&S POS" — a modern, multi-tenant Point of Sale and inventory management web app for small/medium businesses in Kenya, built by S&S Tech Solutions. This is Phase 1 of an incremental build (Phase 1 of 6). Build ONLY what's listed below — do not add Sales, Products, Reports, or AI features yet, those come in later phases.

PRODUCT PHILOSOPHY: "Simple on the surface, powerful underneath." Clean, modern, professional, trustworthy visual identity — an original design, not copied from any existing POS product. Minimal clutter, large clear actions, good empty/loading/error states. Primary use is desktop/laptop but must stay usable on tablet and mobile.

STACK: React + TypeScript + Tailwind + shadcn/ui, with Supabase for auth, Postgres database, and Row Level Security. Default currency KES. No service-role keys or secrets in frontend code.

PHASE 1 SCOPE — Auth, Business Setup, Database Foundation, Roles, RLS:

1. AUTHENTICATION
- Email/password registration and login via Supabase Auth
- Password reset flow
- Logout
- Clear, friendly error messages (never raw Postgres/Supabase error text — e.g. show "This email is already registered" not a raw exception)

2. BUSINESS SETUP (onboarding, shown once right after a new owner registers)
- Step 1: Business info — business name, owner full name, phone, email, address, currency (default KES, editable)
- Step 2: quick "you're all set" confirmation — skip product/user entry for now, that's a later phase
- Should feel like a 60-second wizard, not a form dump

3. DATABASE SCHEMA (Postgres via Supabase migrations) — create exactly these tables now, sized for later phases to build on:
- businesses (id uuid pk, name, contact_phone, contact_email, address, currency default 'KES', receipt_footer, default_low_stock_threshold int default 5, created_at, updated_at)
- profiles (id uuid pk references auth.users, business_id references businesses, full_name, role text check in ('owner','manager','cashier'), is_active boolean default true, created_at) — one row per user, created automatically on signup via trigger
- audit_log (id uuid pk, business_id references businesses, user_id references profiles nullable, action text, entity_type text, entity_id uuid, metadata jsonb, created_at) — not fully wired to every action yet, just the table + a helper function `log_audit_event(...)`, and log at least: user.registered, business.created, user.login

Leave clear room (via comments/migration notes) for tables that will be added in later phases: categories, products, inventory_movements, customers, sales, sale_items, payments, price_history — do NOT create those yet, just don't design anything that would conflict with them (e.g. profiles.business_id and businesses.id are the foreign keys everything else will hang off).

4. ROLES: three fixed roles stored on profiles.role — owner, manager, cashier. On registration, the registering user is always created as 'owner' of their new business (there's no "join an existing business" flow yet — that's later).

5. ROW LEVEL SECURITY (critical):
- Every table scoped by business_id
- A user must only ever see rows where business_id matches their own profiles.business_id — enforce this with RLS policies, not frontend filtering
- Write a reusable Postgres helper function (e.g. `get_user_business_id()`) that RLS policies call, rather than repeating the subquery everywhere
- profiles table: a user can read/update their own profile; owner can read all profiles in their business (needed for later user management, but don't build that UI yet)

6. NAVIGATION SHELL
- Build the app shell now even though most sections are empty: a clean sidebar with Dashboard, Sales, Products, Inventory, Customers, Reports, Users, Settings — each links to a page that just says "Coming in a later phase" for everything except Dashboard and Settings
- Dashboard: simple placeholder for now — "Welcome back, {business name}" — real metrics come in Phase 4
- Settings: show the business info collected during onboarding (read-only for now, editing comes later), plus the logged-in user's name/email and a working logout button
- Bottom of sidebar: logged-in user's name, role badge, and business name

7. ERROR/LOADING/EMPTY STATES: every screen in this phase needs proper loading, error, and empty states — this sets the pattern for every later phase.

CODE QUALITY: TypeScript throughout, small reusable components, clear file/folder separation (e.g. /components/auth, /components/onboarding, /components/layout), no hardcoded IDs or secrets, no duplicate Supabase-query logic scattered across files — centralize data access so later phases can reuse it cleanly.

Do not build Sales, Products, Inventory, Customers, Reports, or Users management UI yet — those are later phases. This phase should end with: a new business owner can register, complete the business-setup wizard, land on a dashboard shell with working navigation, and see their business info in Settings, with the database and RLS foundation solid enough for every later phase to build on without rework.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kenya-pos-foundation.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e672ec81-676f-4597-bf01-770a51d53321).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
