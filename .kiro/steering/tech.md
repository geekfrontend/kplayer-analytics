# KPlayer Analytics - Technology Stack

## Build System

- **Framework**: Next.js 16.2.4 (App Router)
- **Build Tool**: Next.js built-in build system
- **Compiler**: React Compiler enabled (`reactCompiler: true`)

## Core Dependencies

| Category | Library | Version |
|----------|---------|---------|
| Framework | next | 16.2.4 |
| React | react, react-dom | 19.2.4 |
| Database | drizzle-orm, pg | ^0.45.2, ^8.16.3 |
| Auth | bcryptjs, jsonwebtoken | ^3.0.3, ^9.0.3 |
| UI | @radix-ui/*, shadcn/ui | Latest |
| Styling | tailwindcss, class-variance-authority | ^4, ^0.7.1 |
| Forms | react-hook-form, zod, @hookform/resolvers | ^7.75.0, ^4.4.3, ^5.2.2 |
| Data Fetching | @tanstack/react-query, @tanstack/react-table | ^5.100.9, ^8.21.3 |
| Utilities | date-fns, lucide-react, sonner | ^4.1.0, ^1.14.0, ^2.0.7 |
| Logging | winston | ^3.19.0 |

## Development Dependencies

| Category | Library | Version |
|----------|---------|---------|
| Testing | jest, @types/jest, ts-jest | ^30.3.0, ^30.0.0, ^29.4.9 |
| Linting | eslint, eslint-config-next | ^9, 16.2.4 |
| Type Checking | typescript | ^5 |
| Styling | @tailwindcss/postcss, tailwindcss | ^4 |

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run Jest tests |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Run database seeders |

## Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js configuration (React Compiler enabled) |
| `tsconfig.json` | TypeScript configuration with strict mode |
| `eslint.config.mjs` | ESLint configuration with Next.js rules |
| `jest.config.cjs` | Jest test configuration |
| `components.json` | shadcn/ui configuration (New York style, RSC enabled) |
| `postcss.config.mjs` | PostCSS configuration for Tailwind |

## Database

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Migrations**: Custom migration scripts in `scripts/db-migrate.mjs`
- **Seeding**: Custom seed scripts in `scripts/db-seed.mjs`
- **Schema Location**: `db/migrations/`

## Styling Approach

- **CSS Framework**: Tailwind CSS v4
- **CSS Variables**: Enabled (defined in `src/app/globals.css`)
- **Base Color**: Neutral
- **Font Family**: Poppins (via next/font)
- **Component Library**: shadcn/ui (New York style)
- **Icon Library**: Lucide React

## Key Conventions

- **React Compiler**: Enabled - write React code without manual optimization
- **TypeScript**: Strict mode enabled
- **Server Components**: Default (RSC enabled in components.json)
- **Forms**: React Hook Form with Zod validation schemas
- **Styling**: Tailwind utility classes with CSS variables for theming