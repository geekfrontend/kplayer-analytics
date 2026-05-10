# KPlayer Analytics - Product Overview

KPlayer Analytics is a fullstack web application for managing football player data across seasons and clubs. It tracks player statistics, maintains historical records of changes, and provides basic analytics dashboards.

## Core Purpose

- Centralize football player performance data across multiple seasons and clubs
- Maintain immutable history of all statistics changes
- Enable data-driven player evaluation with filtering and summary dashboards

## Key Domains

- **Seasons**: Football seasons (format: YYYY/YYYY)
- **Clubs**: Football clubs with country information
- **Players**: Player profiles including name, date of birth, nationality, and position
- **Assignments**: Linking players to clubs for specific seasons
- **Statistics**: Player performance metrics (minutes played, goals, assists, shots)
- **History**: Audit trail of all statistics changes

## User Roles

| Role | Permissions |
|------|-------------|
| Admin | Full CRUD access to all data, can modify statistics and assignments |
| Analyst | Read-only access to all data, can filter and view dashboards |

## MVP Scope

- Authentication with role-based access control
- CRUD operations for seasons, clubs, and players
- Player-club assignments per season
- Statistics input and update with automatic history tracking
- Filtering, search, and summary dashboard

## Technical Stack

- Framework: Next.js 16 (App Router, React Server Components)
- Database: PostgreSQL with Drizzle ORM
- UI: shadcn/ui (New York style) with Tailwind CSS
- Forms: React Hook Form with Zod validation
- Data Fetching: TanStack Query
- Styling: Tailwind CSS v4 with CSS variables