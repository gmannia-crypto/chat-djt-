# Chat DJT

## Overview
Chat DJT is a mobile-first AI chat application built with Expo (React Native) that offers interactive conversations with an AI impersonating Donald Trump. The project provides a unique experience through a luxury dark/gold UI, real-time streaming chat responses, local conversation persistence, and subscription-based monetization. Key capabilities include Trump-themed therapy, financial debates with various personas, real estate analysis, a digital collectible card system, and a political arena for AI persona debates.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)
The application uses Expo SDK 54, `expo-router` for navigation, and `react-native-reanimated` for animations. It features a stack-based navigation system and manages state with React Query for server data and React hooks for local UI state. Conversation persistence uses AsyncStorage. Real-time chat responses are delivered via Server-Sent Events (SSE). The UI features a dark theme with gold accents, PlayfairDisplay fonts, and supports iOS, Android, and web platforms with a dark mode-only aesthetic. It includes a badges/achievements system, a streak share button, a live activity wall, and a persona memory system. Dedicated screens support multi-persona therapy, financial face-offs, real estate analysis, and Trump's Sports Book, which features live game data, AI-generated persona picks with debate analysis, a bet tally system, and real-time live commentary. The Sports Book also includes a universal picks system, user naming for personalized trash talk, and game-end countdowns with audio cues.

### Backend (Express)
The backend is an Express 5 API gateway handling AI interactions, content generation, and utility functions.
- **AI Chat & TTS**: Streams AI responses using OpenAI and converts text to speech via ElevenLabs and Fish Audio APIs, also handles audio transcription.
- **Content Generation**: Generates various Trump-voice themed content.
- **Therapy System**: Manages token-gated AI therapy sessions with three modes: Quick Session (single AI response), Deep Session + PHQ-9 (structured intake with depression screening, selectable 5/10/15/20-minute durations at 1 token per minute), and Free Chat (open-ended back-and-forth conversation via `/api/therapy/chat`). Per-minute billing endpoint: `/api/therapy/charge-minute`. Dr. Patricia uses AI-generated fresh questions each session (`useAIQuestions` flag) — never repeats questions, each is tailored to the conversation. Returning patients get personalized welcome-back greetings referencing their last session topic. Integrates with Stripe.
- **Financial & Debate Features**: Orchestrates multi-persona financial debates, voting systems, leaderboards, AI property analysis, and Trump's Sports Book with features like pre-game picks, March Madness bracketology (full bracket system, persona analysis, achievements, leaderboard), and specialized personas for Racing and Soccer categories.
- **Trump Reality (Real Estate)**: Offers a 4-tab layout: Airbnb zone scoring (Hot Zones), color-coded Prospect Map with 6 property categories (Rentals, Existing SFH, Prospect SFH, Existing Airbnb, Airbnb Build Potential, Land) and 4 investment tiers (Prime/Growth/Developing/Caution), property search with AI advisor personas (Listings), and interactive AI guide conversations (Tour Guide). The Prospect Map supports location/county search, category filtering, expandable area cards with detailed metrics (median price, population growth, vacancy, walk score, crime index, school ratings, zoning), category breakdowns with progress bars and trend indicators, and average prices per category.
- **Political Arena**: A real-time AI persona conversation engine with 17 political figures (Trump, Netanyahu, Ruckus, Galloway, McConnell, Carville, Maddow, Omar, Biden, Rosie, Bernie Mac, Elon, Graham, Megyn Kelly, Pam Bondi, Candace Owens, Joy Reid), 17 dynamic debate topics (Epstein War, Gaza, Trade War, Immigration, DOGE, Epstein Files, Jan 6th, AI/Big Tech, Supreme Court, Healthcare, Ukraine, China, Climate, Police Reform, Elections, Billionaires, Media Wars) plus live news from 14 RSS feeds, token-gated access with **timed debate sessions** (5/10/15 minutes at 1 token per minute), news-aware personas with emotional reactions, a persona selector, poll voting, and interruption system. Features **direct response queuing** (when a persona asks another a question by name, that persona responds next), **"caucassity" word replacement** (for Joy Reid, Bernie Mac, Ilhan Omar — replaces "audacity" with "caucassity"), **cross-session persona memory** (notable debate moments stored in AsyncStorage and injected into prompts so personas reference past feuds), and **user name/info memory** (returning users' names and locations remembered across sessions). User join system with personalized greetings, voice mic input, and sessions are recorded and shareable.
- **Trump Counterattack System**: Detects attacks on Trump and forces him as the immediate next speaker.
- **Persona Point Tally System**: Users can award points to personas, with a live mini-scoreboard and an end-of-session summary including an AI-generated roast. Winner clap-back feature: after Trump's roast, the winning persona fires back with a savage response via `/api/arena/clap-back`.
- **Pre-Debate Setup**: Users pick debaters and topics before the debate starts via a dedicated setup screen.
- **Therapy Session Memory**: Client-side therapy history stored in AsyncStorage (`chatdjt_therapy_memory`). Tracks last 20 sessions per user (therapist, problem, severity, snippet). History context is sent to the AI therapy endpoint so therapists can reference past sessions, notice patterns, and acknowledge progress. Managed by `recordTherapySession`, `getTherapyHistory`, and `getTherapyContext` in `lib/persona-memory.ts`.
- **Speech Pause System**: Pauses persona TTS and conversation loop during user mic recording. `sessionEndedRef` blocks all TTS/conversation after time expires.
- **Arena Intro Animation**: Cinematic intro with voiceovers, animated persona chips, and countdown. Messages animate in with typewriter effect synced with TTS.
- **Analytics & Monetization**: Tracks user events and integrates with Stripe for payments. Payment fulfillment uses triple redundancy: (1) Stripe webhook handler grants tokens on `checkout.session.completed`, (2) Express `/subscribe` route handles Stripe redirect and grants tokens server-side, (3) frontend `/api/stripe/fulfill` endpoint as a fallback. All token granting uses atomic transactions with `stripe_session_id` deduplication (unique DB index) to prevent double-crediting.
- **Sports All-Time Records**: DB-backed (`sports_records` table) persistent win/loss/streak tracking. Auto-syncs local tallies to server. All-time leaderboard modal accessible from sports screen via `/api/sports/record/leaderboard`, `/api/sports/record/save`, and `/api/sports/record/my-stats`.
- **Sports Music Loop**: Toggle plays `prowling-dragon.mp3` and `zdragon.mp3` in a continuous loop via `playNextTrack()`.
- **Live Sports Audio**: A radio-style module (`sports-media.js`) that lets users pick a live/upcoming/final game, choose a persona commentator, and hear AI-generated play-by-play audio via TTS. Features auto-play mode, prev/next controls, commentary caching, and AbortController-guarded fetch lifecycle.
- **Static Asset Serving**: Serves frontend assets, a landing page, and lazy-loaded feature module JS files from `/js/`.
- **Shared UI Widgets**: Reusable widget classes (e.g., `RatingWidget` in `server/templates/js/rating-widget.js`) loaded eagerly, used by feature modules via delegation-compatible `handleClick`/`handleInput` methods that return booleans.

### Landing Page Event Architecture
The landing page uses document-level event delegation. Three listeners (click, input, keydown) on `.explore-section` route events to the active module's `handleClick`/`handleInput`/`handleKeydown` prototype methods via `getActiveModule()`. Modules must not attach their own `addEventListener` calls — they expose handler methods instead. Shared widgets (like `RatingWidget`) follow the same pattern, returning `true`/`false` to indicate whether they handled the event.

### AI Model System
Supports three AI model modes: Premium (GPT-5.2 + GPT-4o-mini), Budget (DeepSeek V3), and Split (percentage-based routing). An admin interface allows dynamic model selection and cost estimation.

### DJT Collectibles
A digital collectible card system with 24 cards across 6 categories and 4 rarity tiers, earned via a mystery box feature and displayed in a gallery.

## External Dependencies
- **OpenAI API**: For AI chat completions, audio transcription, and AI analysis.
- **ESPN API**: Provides live sports data.
- **ElevenLabs API**: For advanced text-to-speech and voice cloning.
- **Fish Audio API**: For text-to-speech with specific persona voices.
- **@react-native-async-storage/async-storage**: For client-side data persistence.
- **Expo Services**: For mobile-specific functionalities.
- **RevenueCat (`react-native-purchases`)**: For in-app subscription and purchase management.
- **RSS Feeds**: For real-time news headlines.
- **Open-Meteo API**: For weather forecast data.
- **CoinGecko API / Yahoo Finance**: For live market data.
- **Amazon Associates**: For affiliate monetization.
- **Alternative.me Fear & Greed API**: For live Crypto Fear & Greed Index.
- **Stripe**: For payment processing.
- **expo-file-system**: For managing audio files on native platforms.