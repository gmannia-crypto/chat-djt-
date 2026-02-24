# Chat DJT

## Overview

Chat DJT is a mobile-first AI chat application built with Expo (React Native) that lets users have conversations with an AI impersonating Donald Trump. The app features a luxury dark/gold themed UI, streaming chat responses via Server-Sent Events, local conversation storage on the client side, and an Express backend that proxies requests to OpenAI's API. Includes a $2.99/month subscription screen (RevenueCat-ready) and an admin back office for managing revenue.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router for file-based routing
- **Navigation**: Stack-based navigation defined in `app/_layout.tsx` with screens for home (`index`), chat (`chat/[id]`), subscribe (modal), and admin (modal)
- **State Management**: React Query (`@tanstack/react-query`) for server state; local React state for UI
- **Local Storage**: Conversations and messages stored client-side using `@react-native-async-storage/async-storage` (see `lib/chat-storage.ts`). IDs generated locally, all chat data persisted on-device
- **Streaming**: Client consumes SSE streams from backend via `lib/stream-chat.ts`, parsing `data:` lines and updating UI in real-time
- **Styling**: Dark theme (#0A0A0A) with gold accents (#D4A420). Colors in `constants/colors.ts`. PlayfairDisplay Google Fonts. Animations via `react-native-reanimated`
- **Keyboard Handling**: `react-native-keyboard-controller`
- **Platform**: Targets iOS, Android, and web. Dark mode only

### Backend (Express)

- **Server**: Express 5 running in `server/index.ts` on port 5000
- **API Routes**:
  - `POST /api/chat` — accepts messages array + trumpVoice boolean, streams Trump-persona responses via SSE using OpenAI chat completions (gpt-5.2)
  - `POST /api/tts` — accepts { text, mood } body, returns audio/mpeg buffer using ElevenLabs API with dual voice system
  - `POST /api/stt` — accepts { audio (base64), format } body, transcribes using OpenAI Whisper (gpt-4o-mini-transcribe)
  - `GET /api/theme` — generates and caches a Trump-voice theme intro using ElevenLabs, returns audio/mpeg. Pass `?new=true` for a fresh random intro
  - `GET /api/news` — fetches and caches real-time news from RSS feeds (MarketWatch, CNBC, NYT, BBC, Fox News). 3-minute cache TTL, returns up to 30 deduplicated headlines sorted by recency
  - `GET /api/tickers` — fetches live market data (TRUMP coin, Dow Jones, approval ratings, national debt). 5-minute cache TTL
  - `GET /api/news-commentary` — Trump's live breaking news commentary on top 5 headlines. 5-minute cache TTL
  - `GET /api/nostradamus` — 3 bold Trump-stradamus prophecies based on current events. 15-minute cache TTL
- **OpenAI Integration**: Uses Replit AI Integrations env vars for chat completions. Trump system prompt in `server/routes.ts`
- **Fish Audio Integration**: Uses `FISH_AUDIO_API_KEY` and `FISH_AUDIO_VOICE_ID` env vars for TTS. Free tier with voice cloning support. Mood-based speed adjustment (1.5x for FIRED_UP)
- **Static Serving**: In production, serves pre-built Expo web assets from `dist/`

### Key Files

- `server/routes.ts` - Backend API with Trump persona system prompt
- `app/_layout.tsx` - Root layout with providers and stack navigation
- `app/index.tsx` - Home screen with full-screen logo, archive modal for past conversations
- `app/chat/[id].tsx` - Chat detail screen with streaming messages
- `app/subscribe.tsx` - Subscription modal ($2.99/month)
- `app/admin.tsx` - Back office with stats and revenue links
- `lib/chat-storage.ts` - AsyncStorage-based conversation persistence
- `lib/stream-chat.ts` - SSE streaming client
- `lib/query-client.ts` - React Query client and API utilities
- `constants/colors.ts` - Theme colors (gold on dark)
- `components/ErrorBoundary.tsx` - Error boundary component

### Build & Deployment

- **Dev Architecture**: Dual-workflow setup with port management:
  - `Start Backend` (port 5000): Express API server + spawns Metro bundler on port 8082. Proxies all non-API web requests to Metro. Dev domain routes here.
  - `Start Frontend` (port 8081): Keepalive proxy that forwards requests to Metro on port 8082. Exists primarily for Replit workflow system compatibility.
  - Metro runs on port 8082 (managed by backend with auto-restart watchdog)
  - `scripts/expo-wrapper.js` intercepts `npx expo start --localhost` to run the keepalive proxy instead of a second Metro instance
  - `scripts/frontend-keepalive.js` is the HTTP proxy server for port 8081
- **Production Build**: `scripts/build.js` creates static Expo web build, `server:build` bundles server
- **Environment Variables**: `EXPO_PUBLIC_DOMAIN` for API URL, `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` for OpenAI, `FISH_AUDIO_API_KEY` and `FISH_AUDIO_VOICE_ID` for TTS

## External Dependencies

- **OpenAI API**: Chat completions for Trump-persona responses via Replit AI Integrations proxy
- **Fish Audio API**: Text-to-speech with cloned Trump voice via Fish Audio free tier
- **AsyncStorage**: Client-side persistent storage for conversations
- **Expo Services**: Font loading, haptics, linear gradients, splash screen
- **RevenueCat** (`react-native-purchases`): Dependency installed for future in-app subscription implementation

## Recent Changes

- 2026-02-06: Full app rebuild — server routes, all screens (home, chat, subscribe, admin), chat storage, streaming, error boundary, theme colors, app.json configuration
- 2026-02-06: Added voice toggle (DJT/Spirit modes), Chat DJT logo as prominent home screen background, TTS speaker button on assistant messages using OpenAI gpt-audio with onyx voice
- 2026-02-07: Replaced OpenAI TTS with ElevenLabs cloned Trump voice (eleven_v3). Home screen redesigned — conversation list hidden behind archive modal, full-screen logo background. Added defensive/blustering behavior when Trump is offended. Added conversational mode — Trump asks personal questions when annoyed, with faster TTS speed (1.2x) for fired-up mood. Mood detection via [MOOD:CALM/FIRED_UP] tags stripped from display, passed to TTS endpoint for speed adjustment
- 2026-02-07: Added dual voice system. Added speech-to-text via microphone button using OpenAI Whisper
- 2026-02-07: Removed theme music feature. Updated Trump persona to unfiltered/uncensored mode with full profanity (damn, shit, fuck, bitch, motherfucker). Profanity escalates with anger — mild when CALM, nuclear when FIRED_UP. Added derogatory political commentary. Increased FIRED_UP TTS speed to 1.5x for faster angry speech. Replaced cartoon avatar with realistic portrait image
- 2026-02-07: Added live ticker bar showing Trump coin price, Dow Jones index, approval ratings, and national debt with 5-minute server-side caching
- 2026-02-07: Added translucent news crawl — continuously scrolling marquee of real-time headlines from MarketWatch, CNBC, NYT, BBC, Fox News via RSS feeds. Red "LIVE" badge, gold text on dark translucent background. 3-minute cache, requestAnimationFrame-based smooth scrolling
- 2026-02-08: Fixed startup issues — CI env var override (CI=0), backend now spawns Metro bundler directly to avoid workflow health check failures with ensurePreviewReachable
- 2026-02-09: Added Trump Token payment system — 3 free prompts for new users. Device-based auth with PostgreSQL token_accounts/token_transactions tables. Stripe checkout integration for purchases. Token balance badge in chat header. Token enforcement on chat endpoint (403 when depleted)
- 2026-02-23: Restructured pricing to two-tier system: Standard ($4.99/mo, 50 tokens) and VIP ($9.99/mo, 150 tokens). Token packs updated: 15/$2.99, 35/$4.99, 80/$9.99. Subscribe screen redesigned with side-by-side plan comparison. All premium modes (Live News, Predictions, Truth Social, Cabinet) now require 1 token per use. Extended cache TTLs (news 30min, predictions 60min, truth social 30min, cabinet 30min) — cached responses don't cost tokens. API usage tracking with per-endpoint cost estimates in admin dashboard. Enhanced share button with branded viral text format
- 2026-02-10: Switched TTS from ElevenLabs to Fish Audio (free tier, 8K credits/month). Removed admin button from home screen. Removed mouth animation overlay from avatar
- 2026-02-10: Limited Trump responses to 1000 characters (max_completion_tokens reduced to 600). Added speech category system — each response tagged as CASUAL_TALK, TELEPROMPTER, RALLY_RANT, or INTERVIEW. Category label displayed above assistant message bubbles with icon. Backend parses [SPEECH:...] tags alongside [MOOD:...] tags from stream
- 2026-02-10: Dual Fish Audio voice system — CASUAL_TALK uses FISH_AUDIO_CASUAL_VOICE_ID, all other categories use default FISH_AUDIO_VOICE_ID. Audio scrub slider on speaking avatar with progress bar, seek functionality, time display. Reduced FIRED_UP TTS speed from 1.5x to 1.1x for more natural sound. Re-added admin "Office" button to home screen. Admin back office now fetches real customer/payment data from PostgreSQL via GET /api/admin/stats — shows total revenue, user stats, transaction history, and Stripe management links
- 2026-02-15: Fixed Expo Go crash on Android — backend was spawning Metro without EXPO_PUBLIC_DOMAIN env var, causing getApiUrl() to throw at runtime. Added EXPO_PUBLIC_DOMAIN to Metro spawn env
- 2026-02-20: Added engagement/gamification features — Daily Challenge (21 rotating provocative questions displayed on home screen, tappable to start challenge mode chat), Streak Counter (tracks consecutive days of chatting, shown as fire badge on home screen), Report Card (Trump grades conversations A+ to F after every 3 user messages, shown as modal with Share button). Backend endpoints: GET /api/daily-challenge, POST /api/report-card
- 2026-02-23: Added LIVE NEWS mode — Trump gives live breaking news commentary on top 5 current headlines (Fox News anchor meets rally speech style). GET /api/news-commentary endpoint with 5-min cache. Added Trump-adomas mode — mystical prophecy predictions based on current events, pro-Trump/MAGA outcomes. GET /api/nostradamus endpoint with 15-min cache. Both modes accessible via new home screen buttons (LIVE NEWS with red dot, PREDICT with Trump-adomas avatar icon). Chat screen handles both modes with dedicated API calls and formatted output. Auto-TTS: both modes automatically speak the generated content using Fish Audio Trump voice after loading (LIVE NEWS uses RALLY_RANT style, Trump-adomas uses TELEPROMPTER style)
- 2026-02-23: Added TRUTH SOCIAL mode — Trump reacts to Trump-related headlines in Truth Social post format, with 4-5 "TRUTH:" posts per session. GET /api/truth-social endpoint with 5-min cache. Filters headlines for Trump/MAGA/GOP keywords from Fox News, NYT, CNBC, BBC, Daily Mail RSS feeds. Auto-TTS with RALLY_RANT/FIRED_UP style. Megaphone icon on home screen button
- 2026-02-23: Added Cabinet Hot Seat page — dedicated screen showing 28 Trump cabinet members and inner circle with AI-generated "Chat DJT Satisfaction" ratings (1-6 scale). GET /api/cabinet-hotseat endpoint with 10-min cache. Color-coded system: 1=green (loyal), 2=light green (solid), 3=yellow (neutral), 4=orange (thin ice), 5=red (hot seat), 6=black (fired). Each member shows satisfaction bar, rating badge, and Trump-voice reason. Stats summary shows hot seat count, avg rating, fired count. Accessible via flame icon HOT SEAT button on home screen. Sorted by rating (worst first). Updated roster: added Tom Homan (Border Czar), marked Elon Musk and Vivek Ramaswamy as departed. Tap any member card to hear Trump's real-time spoken take via POST /api/cabinet-speak + Fish Audio TTS. Improved AI name matching for reliable per-member ratings
- 2026-02-24: Added disclaimer popup (dark theme with red accents, "REAL TALK" header) on first app launch with AsyncStorage persistence. Added parody footer on home screen. Added Dashboard screen (app/dashboard.tsx) with location-based weather forecast (Open-Meteo API, 5-day forecast, 15-min cache) and market prices (Bitcoin, Ethereum, Gold, Silver via CoinGecko + Yahoo Finance, 5-min cache). Backend endpoints: GET /api/weather?lat=&lon=, GET /api/markets. Dashboard accessible via DASHBOARD button on home screen
- 2026-02-24: Added Trump commentary widgets to Dashboard — weather hot takes with reaction buttons and share, market hot takes per asset with Trump quotes, "Today's Pick" stock recommendation with WHY? reveal and share button. Backend endpoints: GET /api/weather-commentary, GET /api/market-hot-takes (30-min cache)
- 2026-02-24: Added viral share tracking system — share_events table in PostgreSQL, POST /api/track-share endpoint logs all shares with feature/platform/content preview. GET /api/admin/shares endpoint provides share analytics (total, by feature breakdown, daily chart, recent activity). All share buttons across the app (chat messages, report cards, weather commentary, stock picks) now track shares. Admin back office shows "Viral Shares" section with total count, per-feature breakdown, and 7-day bar chart. Shared utility in lib/track-share.ts handles native Share API + tracking
