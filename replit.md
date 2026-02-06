# Chat DJT

## Overview

Chat DJT is a mobile-first AI chat application built with Expo (React Native) that lets users have conversations with an AI impersonating Donald Trump. The app features a dark/gold themed UI, streaming chat responses via Server-Sent Events, local conversation storage on the client side, and an Express backend that proxies requests to OpenAI's API. There's also a subscription screen (currently a placeholder/mock) and an admin stats page.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router for file-based routing
- **Navigation**: Stack-based navigation defined in `app/_layout.tsx` with screens for home (`index`), chat (`chat/[id]`), subscribe (modal), and admin (modal)
- **State Management**: React Query (`@tanstack/react-query`) for server state; local React state for UI
- **Local Storage**: Conversations and messages are stored client-side using `@react-native-async-storage/async-storage` (see `lib/chat-storage.ts`). The app generates IDs locally and persists all chat data on-device
- **Streaming**: The client consumes SSE streams from the backend via `lib/stream-chat.ts`, parsing `data:` lines and updating the UI in real-time as tokens arrive
- **Styling**: Dark theme with gold accents. Colors defined in `constants/colors.ts`. Uses PlayfairDisplay Google Fonts. Animations via `react-native-reanimated`
- **Keyboard Handling**: `react-native-keyboard-controller` with a compatibility wrapper (`KeyboardAwareScrollViewCompat`) that falls back to regular ScrollView on web
- **Platform**: Targets iOS, Android, and web. Dark mode only (`userInterfaceStyle: "dark"`)

### Backend (Express)

- **Server**: Express 5 running in `server/index.ts` on port 5000
- **API Route**: `POST /api/chat` — accepts an array of messages, streams back Trump-persona responses via SSE using OpenAI's chat completions API
- **OpenAI Integration**: Uses Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` env vars). The Trump system prompt is defined in `server/routes.ts`
- **CORS**: Dynamic CORS handling that allows Replit domains and localhost origins for development
- **Static Serving**: In production, serves pre-built Expo web assets from `dist/` directory

### Database (PostgreSQL + Drizzle ORM)

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` defines a `users` table; `shared/models/chat.ts` defines `conversations` and `messages` tables
- **Migrations**: Managed via `drizzle-kit push` (no migration files generated, direct push to DB)
- **Server Storage**: `server/replit_integrations/chat/storage.ts` provides a DB-backed storage layer for conversations/messages, though the primary app currently uses client-side AsyncStorage instead
- **In-Memory Fallback**: `server/storage.ts` has a `MemStorage` class for users that doesn't use the database

### Replit Integrations

Located in `server/replit_integrations/`, these are pre-built modules:
- **chat/**: DB-backed conversation CRUD + streaming chat routes
- **audio/**: Voice chat with speech-to-text and text-to-speech capabilities (ffmpeg-based audio conversion)
- **image/**: Image generation using `gpt-image-1` model
- **batch/**: Batch processing utilities with rate limiting (`p-limit`) and retries (`p-retry`)

Client-side audio utilities are in `.replit_integration_files/client/` (React hooks for recording, playback, and voice streaming — primarily for web).

### Build & Deployment

- **Dev**: Two processes — `expo:dev` for the Expo dev server and `server:dev` for the Express backend (via `tsx`)
- **Production Build**: `scripts/build.js` handles creating a static Expo web build, then `server:build` bundles the server with esbuild. Production runs via `server:prod`
- **Environment Variables**: `EXPO_PUBLIC_DOMAIN` for the client to reach the API, `DATABASE_URL` for PostgreSQL, `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` for OpenAI

## External Dependencies

- **OpenAI API**: Chat completions for Trump-persona responses, image generation, and audio transcription/TTS. Accessed through Replit AI Integrations proxy
- **PostgreSQL**: Database for users, conversations, and messages. Connected via `DATABASE_URL` environment variable
- **AsyncStorage**: Client-side persistent storage for conversations (React Native)
- **Expo Services**: Font loading, haptics, image picker, linear gradients, splash screen management
- **RevenueCat** (`react-native-purchases`): Listed as a dependency for in-app subscriptions (subscription screen exists but appears to be a placeholder)