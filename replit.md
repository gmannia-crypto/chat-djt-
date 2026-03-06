# Chat DJT

## Overview

Chat DJT is a mobile-first AI chat application built with Expo (React Native) designed for interactive conversations with an AI impersonating Donald Trump. The project aims to deliver a unique experience through a luxury dark/gold UI, real-time streaming chat responses, and local conversation persistence. It incorporates subscription-based monetization and an admin interface for revenue management, targeting a broad audience interested in political satire and AI interaction. Key capabilities include Trump-themed therapy sessions, financial debates with various personas, and Trump-centric real estate analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

The application is developed with Expo SDK 54, using `expo-router` for routing and `react-native-reanimated` for animations. It features a stack-based navigation for core functionalities like chat, subscription, and admin. State management utilizes React Query for server data and React's built-in hooks for local UI state. Conversations are locally persisted with AsyncStorage. Real-time chat responses are handled via Server-Sent Events (SSE). The UI adheres to a dark theme with gold accents and PlayfairDisplay fonts, supporting iOS, Android, and web platforms with a dark mode-only aesthetic. It includes interactive elements like pulsating CTA buttons, a 24-hour mystery box with reward types, and keyboard handling via `react-native-keyboard-controller`. Dedicated screens for multi-persona therapy, financial face-offs, real estate analysis, and Trump's Sports Book are implemented, each with specific UI elements and interactions like therapist selectors, debate arenas, voting mechanisms, property advisors, and sports picks. Photorealistic AI-generated persona images are stored at `assets/images/persona-{id}.png` for all 12 active personas (trump, buffett, musk, suze, dave, grandma, genie, mansa, loudmouth, jordan, bernie, ruckus) plus robot. Loudmouth (Stephen A. Smith-inspired) is in Sports Book and Faceoff; Mansa Musa remains in Faceoff and Real Estate. The home screen features a badges/achievements system tracking 9 badges via AsyncStorage (streak milestones, conversation counts, mystery box opens, Trump ratings, explorer status), a streak share button (Twitter/X on web, native Share on mobile), and a live activity wall. The persona memory system (`lib/persona-memory.ts`) tracks win/loss records, head-to-head matchups, relationship scores, and generates self-aware trash talk and opening statements for Financial Faceoff and Sports Book debates, all persisted via AsyncStorage. Trump's Sports Book (`app/sports.tsx`) is prominently placed at the top of the home screen feature grid with a LIVE badge, features a FIFA World Cup 2026 live countdown (June 11, 2026), displays upcoming games from `/api/sports/upcoming` across NFL, NBA, UFC, MLB, and Soccer, with real-time AI-generated persona picks via `POST /api/sports/picks` (each persona generates unique in-character analysis using GPT-4o-mini with persona-specific system prompts, cached for 30s per game+persona), AbortController-based request cancellation on persona switch, refresh button per game card, and AI-powered debate picks. Previously static picks were replaced with live AI reactions. The screen also shows Ruckus is contrarian, etc.), a "Today's Debate" section with two personas debating a featured game using full persona memory (trash talk, H2H records, generateReference opening statements), TTS listen buttons, and sportsbook affiliate links (DraftKings, FanDuel).

### Backend (Express)

The backend is an Express 5 API gateway providing various endpoints for AI interactions, content generation, and utility functions. It serves:
- **AI Chat & TTS**: Streams Trump-persona responses via SSE using OpenAI (gpt-5.2) and converts text to speech using ElevenLabs and Fish Audio APIs (with Trump, Sophia, and James voices). It also handles audio transcription using OpenAI Whisper.
- **Content Generation**: Generates Trump-voice theme intros, news commentary, market hot takes, prophecies, daily challenges, Truth Social reactions, cabinet commentary, and weather commentary.
- **Therapy System**: Supports token-gated AI therapy sessions with multiple therapist personas (Trump, Sophia, James), multi-round follow-up conversations, template-based free therapy for viral pages, and integrates with Stripe for checkout.
- **Financial & Debate Features**: Manages financial face-off debates with multiple personas, including voting, leaderboards, and a "Persona of the Week" voting system. It also provides AI-powered property analysis using OpenAI with persona-specific commentary and generates mortgage calculations with Trump's insights. Trump's Sports Book (`/sports-betting`) provides AI persona sports picks and debates across NFL, NBA, UFC, MLB, and Soccer with sportsbook affiliate links (DraftKings, FanDuel, Bet365, Stake).
- **Analytics & Monetization**: Tracks app share events, viral session events, and integrates with Stripe for therapy session payments.
- **Static Asset Serving**: Serves pre-built Expo web assets in production.
- **Landing Page**: In production, the root path serves a landing page (`server/templates/landing-page.html`) with an inline Sports Book tab (persona debate, games, affiliate links), plus tab links to Financial Faceoff, Therapy, and Multi Therapy standalone pages. In dev mode, the root path is proxied to Metro for the Expo web app.

## External Dependencies

- **OpenAI API**: Used for AI chat completions (gpt-5.2), audio transcription (Whisper), AI-powered property analysis (gpt-4o-mini), and real-time AI persona sports picks (gpt-4o-mini via `POST /api/sports/picks`).
- **ESPN API** (free, no key): Live sports data for NBA, NFL, MLB, UFC, Soccer (EPL, UCL, MLS) via `site.api.espn.com/apis/site/v2/sports/`. Returns real games, scores, odds from DraftKings. Cached 5 minutes. Boxing fights use curated data. Completed games are filtered out.
- **ElevenLabs API**: Utilized for advanced text-to-speech, including voice cloning and generating theme intros.
- **Fish Audio API**: Provides text-to-speech for various personas, including a cloned Trump voice, Dr. Sophia's voice (ID: `193c58af62ea487180baacdef8a69bbd`), and Dr. James's voice (ID: `03397b4c4be74759b72533b663fbd001`).
- **@react-native-async-storage/async-storage**: For client-side data persistence.
- **Expo Services**: For mobile functionalities (fonts, haptics, gradients, splash screens).
- **RevenueCat (`react-native-purchases`)**: For in-app subscription and purchase management.
- **RSS Feeds**: For real-time news headlines (e.g., MarketWatch, CNBC, NYT, BBC, Fox News).
- **Open-Meteo API**: For weather forecast data.
- **CoinGecko API / Yahoo Finance**: For live market data.
- **Amazon Associates**: For affiliate monetization with the `trumpbot-20` tag.
- **Alternative.me Fear & Greed API**: For live Crypto Fear & Greed Index on home screen (`https://api.alternative.me/fng/?limit=1`).
- **Stripe**: For payment processing for therapy sessions and subscriptions.
- **expo-file-system**: Used by `lib/audio-helper.ts` to write TTS audio to temp files on native (iOS/Android) for reliable playback via expo-av. On web, data URIs are used instead.

## AI Model System

The app supports dual AI model tiers managed via `GET/POST /api/model-settings`:
- **Premium**: GPT-5.2 (chat) + GPT-4o-mini (fast) — best quality, higher cost (~$8/1K requests)
- **Budget**: DeepSeek V3 (chat + fast) — ~98% cheaper (~$0.08/1K requests), good quality
- Model tier is switchable in real-time from the Admin (Back Office) screen
- `POST /api/model-test` runs side-by-side comparison with cost analysis
- All `openai.chat.completions.create` calls use `getClient()` and `getChatModel()`/`getFastModel()` for dynamic model routing
- DeepSeek requires `DEEPSEEK_API_KEY` environment variable
- Audio transcription always uses OpenAI (Whisper) regardless of tier

## Persona Dialogue Styles

- **Bernie Mac**: RAW, unfiltered Black English style — uses "DAMN!", "Got-DAMN!", "I ain't scared of you, muttuphuk!", "summa ma bitch!", "sheeeeit", "I ain't playin' wit' y'all!", "ain't finna", etc. Cuss freely like his actual stand-up comedy.
- **Uncle Ruckus**: Self-hating Black man (The Boondocks satire) — worships white people/culture, uses "I tell you what", "dadgum", "praise White Jesus", "the WHITE man's way is the RIGHT way", "I got re-vitiligo", "I ain't Black, I'm Uncle Ruckus — no relation". Always contrarian, praises white athletes/neighborhoods, disparages Black culture. Outrageously offensive in the satirical Boondocks style.

## Amazon Affiliate Integration

- Tag: `trumpbot-20` used across all Amazon links
- Sports Book screen has a "GEAR UP" section with persona-specific product recommendations
- Each of the 11 personas has unique Amazon product cards (3 per persona) plus a main "Shop" button
- Key persona products: MJ → Air Jordans, Trump → MAGA/Golf, Buffett → Investing books, Musk → Tech gadgets, Bernie Mac → Funny tees/Chi-Town gear, Ruckus → Camo/BBQ/Work boots, etc.
- Product cards dynamically switch when the user changes the selected persona