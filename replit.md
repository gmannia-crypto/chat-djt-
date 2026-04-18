# Chat DJT

## Overview
Chat DJT is an Expo (React Native) mobile-first AI chat application featuring interactive conversations with an AI impersonating Donald Trump. It offers a luxury dark/gold UI, real-time streaming chat responses, local conversation persistence, and a subscription-based monetization model. Key features include Trump-themed therapy, financial debates with various personas, real estate analysis, a digital collectible card system, and a political arena for AI persona debates. The project aims to provide a unique and engaging user experience through its specialized AI interactions and themed content.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)
The application is built with Expo SDK 54, utilizing `expo-router` for navigation and `react-native-reanimated` for animations. It features a stack-based navigation system, manages state with React Query for server data, and React hooks for local UI state. Conversation persistence is handled via AsyncStorage. Real-time chat responses are delivered using Server-Sent Events (SSE). The UI adheres to a dark theme with gold accents, PlayfairDisplay fonts, and supports iOS, Android, and web platforms with a dark mode-only aesthetic. It includes features like badges/achievements, a streak share button, a live activity wall, and a persona memory system. Dedicated screens support multi-persona therapy, financial face-offs, real estate analysis ("Trump Reality"), and "Trump's Sports Book," which includes live game data, AI-generated persona picks with debate analysis, a bet tally system, real-time live commentary, universal picks, user-named trash talk, and game-end countdowns with audio cues.

### Backend (Express)
The backend is an Express 5 API gateway responsible for AI interactions, content generation, and utility functions.
- **AI Chat & TTS**: Manages AI responses using OpenAI and text-to-speech conversion via ElevenLabs and Fish Audio APIs, including audio transcription.
- **Content Generation**: Generates various Trump-voice themed content.
- **Therapy System**: Manages token-gated AI therapy sessions with Quick Session, Deep Session + PHQ-9, and Free Chat modes, featuring upfront token billing (5/10/15 tokens for 5/10/15 minute sessions via `POST /api/therapy/start-session`) and personalized AI-generated questions that never repeat. Enhanced therapist personas with unique worldviews, credentials, current events awareness, and distinct personalities (Dr. Sophia: multicultural/social justice; Dr. James: Harvard/data-driven pragmatist; Dr. Serena: POC awareness, nature metaphors, girlfriend tone for females, sarcastic humor for crude males; Dr. Trump: political/business references). Shareable Diagnosis Plan feature generates structured treatment plans with Dr credentials, picture, signature, numbered treatment steps, actionable solutions, and session notes (endpoint: `POST /api/therapy/diagnosis-plan`). Dr. Serena gets a fullscreen desktop intro modal before video.
- **Trump Billionaires Game**: An AI-powered ethical choices simulator where players make decisions to reach $1 billion across 10 dynamically generated industries. Trump provides personalized AI-generated voice analysis for each choice. Features server-side profit validation with per-tier clamping (T1: $3M-$20M through T5: $80M-$250M), deal streak bonuses (+25% at 3x, +50% at 5x), 8 net worth milestones ($5M-$750M), random market events (booms, crashes, IPOs, lawsuits), and breaking news headlines after every deal. AI prompt enforces full dollar amounts (3000000 not 3) to prevent micro-deal bugs.
- **Financial & Debate Features**: Orchestrates multi-persona financial debates, voting systems, leaderboards, AI property analysis, and Trump's Sports Book with individual persona picks per game and an "All Analyst Picks" grid on each game card.
- **Trump Reality (Real Estate)**: Offers Airbnb zone scoring, a color-coded Prospect Map with 6 property categories and 4 investment tiers, property search with AI advisor personas, and interactive AI guide conversations. Tour guide personas (Victor Sterling, Dr. Mya Chen, Tommy O'Brian, Sofia Riviera, Pamela Williams) have dedicated Fish Audio voice IDs.
- **Sports Book Tabs**: The sportsbook uses a tabbed navigation system (GAMES, DC ROYAL, ANALYSIS, DEBATE, SHOP) to organize content into pages instead of endless scrolling. The DC Royal tab features a live sports crawl ticker (ESPN headlines + track & field), a crown system for top-performing persona analysts (persisted via AsyncStorage), **timed DC Royal debates** (arena-style 5/10/15 minute live debates between winning analysts with TTS speaking, upfront token billing via `POST /api/sports/dc-royal/start-debate` and per-message generation via `POST /api/sports/dc-royal/respond`), an all-time DC Royal crown leaderboard, league standings for NBA/NFL/MLB/NHL/EPL/MLS, **Question of the Day** (AI-generated daily sports trivia), and **Player Stats Lookup** (search any player across NBA/NFL/MLB/NHL with ESPN stats). Game cards show date/time from ESPN data, YouTube highlights button, and music toggle in header. Persona picks now cite specific stats and records.
- **Political Arena**: A real-time AI persona conversation engine with 20 political figures and 24 daily dynamic debate topics generated from live RSS headlines, plus custom user topic creation. It features token-gated timed debate sessions, news-aware personas with emotional reactions, a persona selector, poll voting, an interruption system, mid-debate breaking news banners, direct response queuing, cross-session persona memory, and user name/info memory. Featured prominently at the top of the home screen as the first content users see.
- **Trump Counterattack System**: Automatically forces Trump as the next speaker if attacks on him are detected.
- **Persona Point Tally System**: Allows users to award points to personas, featuring a live mini-scoreboard and an AI-generated end-of-session roast with a "winner clap-back" feature.
- **Arena Win Tally System**: Tracks historical wins per user and globally, incorporating win records into persona prompts for competitive trash-talk.
- **Global Arena Leaderboard**: Displays an all-time leaderboard of users and popular personas.
- **Arena Usage Rewards**: Provides automatic token rewards for time spent in the Arena, based on reward tiers.
- **Therapy Session Memory**: Server-side PostgreSQL storage of therapy sessions with sentiment analysis, topic extraction, relationship tracking (sentiment scores), and personalized greetings. Client-side AsyncStorage fallback also available. Tables: `therapy_sessions`, `therapy_relationships`. Endpoints: `/api/therapy/greeting`, `/api/therapy/history`, `/api/therapy/lip-sync`.
- **Lip-Sync Video Generation**: Uses fal.ai SadTalker to generate lip-synced talking-head videos from therapist portraits + Fish Audio TTS. Premium feature behind token gate. Endpoint: `POST /api/therapy/lip-sync` (text + personaId → videoUrl + audioBase64).
- **Speech Pause System**: Manages pausing of TTS and conversation loops during user mic recording.
- **Arena Intro Animation**: Cinematic intro with voiceovers, animated persona chips, and a countdown.
- **Push Notifications**: Admin can send push notifications to all registered devices. Client auto-registers push tokens on first launch (iOS/Android only, web gracefully skips). Server stores tokens in PostgreSQL `push_tokens` table with auto-pruning of invalid tokens. Admin UI section in Back Office with device count, title/body inputs, and send button. Endpoints: `POST /api/push-tokens`, `DELETE /api/push-tokens`, `POST /api/admin/send-notification`, `GET /api/admin/push-token-count`.
- **Analytics & Monetization**: Tracks user events and integrates with Stripe for payment processing, employing triple-redundancy for token fulfillment.
- **Sports All-Time Records**: Persistent win/loss/streak tracking for sports, with auto-syncing to the server and an all-time leaderboard.
- **Live Sports Audio**: A radio-style module offering AI-generated play-by-play audio for live/upcoming/final games with persona commentators.
- **AI Model System**: Supports Premium (GPT-5.2 + GPT-4o-mini), Budget (DeepSeek V3), and Split (percentage-based routing) AI model modes, with an admin interface for dynamic selection and cost estimation. Default mode: Budget (economy).
- **Token Win Celebration**: Video celebration modal (`components/TokenWinVideo.tsx`) plays `server/public/token-win.mp4` with haptic feedback cascade on token purchase/subscription fulfillment. Token image: `assets/images/dc-lightning-token.jpeg` (Dynamic Creations lightning coin).
- **DJT Collectibles**: A digital collectible card system with 24 cards across 6 categories and 4 rarity tiers, earned via a mystery box.
- **Engagement System**: Daily visit streak tracking, badge/achievement system (10 badges), shareable result cards with social sharing (X/Facebook/Copy/native), and toast notifications. Context: `lib/engagement-context.tsx`. Components: `ShareCard.tsx`, `StreakToast.tsx`. Streak badge shows in main menu header. Share cards trigger after arena debates, therapy sessions, and fortune readings. Badges: First Session, 3/7/30-Day Streaks, Arena Debut, Therapy Graduate, Fortune Seeker, Roast Survivor, First Share, 5 Debates.
- **Lip-Sync Provider Comparison**: Supports both Dreamface (NewportAI) and fal.ai SadTalker with automatic fallback. Comparison endpoint: `POST /api/therapy/lip-sync-compare`. Default order: Dreamface first, fal.ai fallback.

### Landing Page Event Architecture
The landing page uses document-level event delegation, with three listeners (click, input, keydown) on `.explore-section` routing events to active module methods.

## External Dependencies
- **OpenAI API**: AI chat, audio transcription, and analysis.
- **ESPN API**: Live sports data.
- **ElevenLabs API**: Advanced text-to-speech and voice cloning.
- **Fish Audio API**: Persona-specific text-to-speech.
- **@react-native-async-storage/async-storage**: Client-side data persistence.
- **Expo Services**: Mobile-specific functionalities (including push notifications via `expo-notifications`).
- **Expo Push API**: Server-side push notification delivery to registered devices.
- **RevenueCat (`react-native-purchases`)**: In-app purchases and subscriptions.
- **RSS Feeds**: Real-time news headlines.
- **Open-Meteo API**: Weather forecast data.
- **CoinGecko API / Yahoo Finance**: Live market data.
- **Amazon Associates**: Affiliate monetization.
- **Alternative.me Fear & Greed API**: Live Crypto Fear & Greed Index.
- **Stripe**: Payment processing.
- **expo-file-system**: Audio file management on native platforms.
- **fal.ai**: SadTalker lip-sync video generation (fallback provider).
- **DreamFace (DreamAPI by NewportAI)**: Primary lip-sync video generation via `api.newportai.com`. Uses `DREAMFACE_API_KEY` secret. Falls back to fal.ai if not configured.

## Global Sound Toggle
A floating sound toggle button (SoundToggle component) appears on the main menu, therapy, and sports screens. It uses a React context (`SoundProvider` in `lib/sound-context.tsx`) with AsyncStorage persistence. When sound is off, all TTS calls (therapy greetings, therapy readback, sports persona speak) and UI sound effects (click, transition) are suppressed. The toggle is a red pill button in the bottom-right corner that turns grey when muted.

## Company Website (T. Marquell Supreme LLC)
A static company website served at `/company` with pages for privacy policy (`/company/privacy`), terms of service (`/company/terms`), sitemap (`/company/sitemap.xml`), and robots.txt (`/robots.txt`). Files in `server/company-site/`. Contact form POSTs to `/api/company/contact`. SEO-ready with structured data (JSON-LD), Open Graph tags, and Google Search Console compatible.

## HTML Standalone Pages
- `/therapy-multi` — Multi-persona therapy page. Served from `server/templates/therapy-multi.html`.
- `/therapy-viral` — Viral sharing therapy page. Served from `server/templates/therapy-viral.html`.

## Lip-Sync Video Integration
The therapy chat (both Expo app and HTML standalone page) supports optional lip-sync video generation:
- Toggle in chat header enables/disables video mode (costs 1 extra token per response)
- When enabled: therapist response → Fish Audio TTS → DreamAPI (primary) or fal.ai SadTalker (fallback) → video URL
- DreamAPI uses async task pattern: upload portrait+audio → submit talking_face task → poll for result → return video URL
- Falls back to audio-only TTS if video generation fails
- Video opens in external player via Linking.openURL (native) or window.open (web)

## Menu Music System
Menu music on the home screen auto-pauses when navigating to any category screen (therapy, arena, sports, etc.) via `useFocusEffect`. Resumes when returning to home if it was playing. No two music tracks ever play simultaneously.

## Arena Token Enforcement
Arena uses a hard limit of 5 free debate API calls per device. Free uses are counted even during the initial 2-minute free trial window. After 5 uses, the server returns 403 `arena_locked` and the frontend shows a paywall. The START DEBATE button always confirms with the server before proceeding — if the status check fails or the device has no ID, the paywall is shown. Back button during an active debate shows a confirmation dialog.
## Recent additions (Apr 18 2026)
- **RFK Jr. mystery persona**: Added Robert F. Kennedy Jr. as 8th unlockable arena persona. Voice ID dc436d1018d5496ebbc39cc7498042d8. Stuttering/raspy/conspiracy-rambling personality with brain worm, dead bear, whale head, anti-vax history that other personas (Maddow, Carville, Joy Reid) actively mock.
- **MTG attacks Elon on immigration**: Updated MTG arena prompt with relentless attacks on Elon's South African student-visa-overstay history.
- **Sports debate fluid overlap**: Reduced sports debate inter-turn delay from 6-10s to text-length-based heuristic with 1s overlap target.
- Added 'wildcard' faction color (purple) and RFK PERSONA_ALIASES.

