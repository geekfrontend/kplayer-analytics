# KPlayer Analytics - Project Structure

## Directory Layout

```
kplayer-analytics/
├── .kiro/              # Kiro configuration and steering rules
├── .next/              # Next.js build output
├── .trae/              # Project documentation and rules
│   ├── docs/           # Product and API documentation
│   │   ├── PRD.md      # Product Requirements Document
│   │   ├── ERD.md      # Entity Relationship Diagram
│   │   └── api/        # API documentation
│   ├── rules/          # Project-specific rules
│   │   └── design-system.md
│   └── skills/         # Skill definitions for AI assistants
├── db/                 # Database schema and migrations
│   └── migrations/     # Database migration files
├── scripts/            # Utility scripts
│   ├── db-migrate.mjs  # Database migration runner
│   └── db-seed.mjs     # Database seeder
├── src/
│   ├── app/            # Next.js App Router pages
│   │   ├── (auth)/     # Auth routes (login, register)
│   │   ├── (protected)/ # Protected routes
│   │   ├── api/        # API route handlers
│   │   ├── layout.tsx  # Root layout
│   │   └── globals.css # Global styles and CSS variables
│   ├── components/     # React components
│   │   ├── ui/         # shadcn/ui components
│   │   └── app/        # App-specific components
│   ├── db/             # Database schema and queries (Drizzle)
│   ├── hooks/          # Custom React hooks
│   └── lib/            # Utility libraries
│       ├── api-client.ts # API client setup
│       ├── auth.ts       # Authentication utilities
│       └── utils.ts      # Shared utility functions
├── tests/              # Test files
├── public/             # Static assets
├── .env                # Environment variables (not committed)
├── package.json
├── tsconfig.json
├── next.config.ts
├── components.json
└── README.md
```

## Key Conventions

### App Router Structure

- **Auth routes**: `(auth)/` folder for login, register, logout
- **Protected routes**: `(protected)/` folder for authenticated pages
- **API routes**: `app/api/` for server-side endpoints
- **Layouts**: Root layout in `app/layout.tsx`, nested layouts as needed

### Component Organization

- **UI components**: `src/components/ui/` - shadcn/ui components
- **App components**: `src/components/app/` - feature-specific components
- **Imports**: Use `@/` alias to `src/` directory

### Database Organization

- **Schema**: Define in `src/db/` using Drizzle ORM
- **Migrations**: Generated in `db/migrations/`
- **Queries**: Use Drizzle query builder in `src/db/` or API routes

### Styling Conventions

- **CSS Framework**: Tailwind CSS v4
- **CSS Variables**: Defined in `src/app/globals.css`
- **Component Styling**: Use `class-variance-authority` for variant-based styling
- **Utility Classes**: Tailwind utility classes with `tw-animate-css` for animations

### Form Conventions

- **Library**: React Hook Form
- **Validation**: Zod schemas
- **Integration**: `@hookform/resolvers/zod`

### API Client

- **Location**: `src/lib/api-client.ts`
- **Pattern**: Typed API client for server-side and client-side usage
- **Authentication**: Handle session/token in `src/lib/auth.ts`

## Naming Conventions

- **Files**: kebab-case for routes (e.g., `player-stats.tsx`)
- **Components**: PascalCase (e.g., `PlayerStatsTable`)
- **Functions**: camelCase (e.g., `fetchPlayerStats`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_PAGE_SIZE`)
- **Database Tables**: snake_case (e.g., `player_stats`)
- **Database Columns**: snake_case (e.g., `minutes_played`)

## Path Aliases

- `@/` → `./src/`
- `@/components` → `./src/components/`
- `@/lib` → `./src/lib/`
- `@/ui` → `./src/components/ui/`
- `@/db` → `./src/db/`