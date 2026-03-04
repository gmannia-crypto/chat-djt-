# Chat DJT

## Overview

Chat DJT is a mobile-first AI chat application built with Expo (React Native) that enables users to engage in conversations with an AI impersonating Donald Trump. The project aims to provide a unique, interactive experience with a distinct luxury dark/gold UI, real-time streaming chat responses, and local conversation persistence. It includes features for monetization through subscriptions and an admin interface for revenue management, targeting a broad market interested in political satire and AI interaction.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

The application is built with Expo SDK 54, utilizing `expo-router` for file-based routing and `react-native-reanimated` for animations. Navigation is stack-based, supporting screens for home, chat, subscription, and admin functionalities. State management for server data is handled by React Query, while local UI state uses React's built-in capabilities. Conversations and messages are persisted client-side using AsyncStorage. The client consumes Server-Sent Events (SSE) for streaming chat responses, parsing data lines to update the UI in real-time. The UI features a dark theme with gold accents and PlayfairDisplay fonts, targeting iOS, Android, and web platforms with a dark mode-only aesthetic. Keyboard handling is managed by `react-native-keyboard-controller`. The home screen features pulsating green/purple viral CTA buttons for Trump Therapy and Fortune Parlor with LinearGradient backgrounds and reanimated pulse animations.

### Backend (Express)

The backend is an Express 5 server running on port 5000, serving as an API gateway. It provides endpoints for:
- `POST /api/chat`: Streams Trump-persona responses via SSE using OpenAI chat completions (gpt-5.2).
- `POST /api/tts`: Converts text to speech using ElevenLabs API with a dual voice system.
- `POST /api/stt`: Transcribes audio using OpenAI Whisper (gpt-4o-mini-transcribe).
- `GET /api/theme`: Generates and caches a Trump-voice theme intro using ElevenLabs.
- `GET /api/news`: Fetches and caches real-time news headlines from various RSS feeds.
- `GET /api/tickers`: Fetches and caches live market data for specific assets.
- `GET /api/news-commentary`: Provides Trump's commentary on top news headlines.
- `GET /api/nostradamus`: Generates Trump-themed prophecies.
- `GET /api/daily-challenge`: Provides daily provocative questions.
- `POST /api/report-card`: Grades user conversations.
- `GET /api/truth-social`: Generates Trump's reactions to headlines in Truth Social format.
- `GET /api/cabinet-hotseat`: Displays satisfaction ratings for Trump's cabinet members.
- `POST /api/cabinet-speak`: Generates spoken commentary on cabinet members.
- `GET /api/weather`: Provides location-based weather forecasts.
- `GET /api/markets`: Provides market prices for various assets.
- `GET /api/weather-commentary`: Generates Trump's weather hot takes.
- `GET /api/market-hot-takes`: Provides Trump's market hot takes.
- `POST /api/track-share`: Logs app share events and returns total/daily share counts.
- `GET /api/admin/shares`: Provides share analytics for the admin dashboard.
- `GET /api/therapy/card`: Serves a shareable HTML therapy card with patient name/therapy via query params.
- `POST /api/therapy/checkout`: Creates Stripe checkout sessions for therapy payments (single $2.99, weekly $9.99, monthly $19.99).
- `POST /api/rate-trump`: Allows users to rate Trump, triggering AI reactions.
- `GET /api/rate-trump/leaderboard`: Displays a leaderboard of supporters and haters.
- `POST /api/create-challenge`: Creates a shareable challenge link.
- `GET /api/challenge/:id`: Retrieves challenge details.
- `POST /api/fortune`: Generates Trump-style fortune predictions based on name, birthday/zodiac and topic (token-gated).
- `POST /api/therapy`: Generates therapy responses based on selected therapist voice (token-gated). Supports `voice` parameter: `trump` (Trump-style with deal metaphors), `sophia` (therapeutic techniques: validation, grounding, attachment theory), `james` (CBT: cognitive distortions, Socratic questioning, behavioral experiments). Includes template-based fallback if AI fails. Supports multi-round follow-up conversations: returns `followUp` question and `followUpIndex`; subsequent calls with `previousAnswer` and `followUpIndex` return template-based follow-up responses (no extra AI cost).
- Therapy page features: therapist selector (3 therapists with photos), cinematic intro animation per therapist, background images (trump-therapist.png, dr-sophia.jpg, dr-james.jpg), speech-to-text input (mic button), dynamic color theming per therapist, 2-minute session countdown timer, follow-up conversation rounds (up to 3 rounds with in-character questions), conversation history display, "Dr. Trump's RX" Amazon affiliate product recommendations (health/wellness supplements with `trumpbot-20` tag).
- `GET /therapy-viral`: Serves standalone viral therapy landing page (3-question flow, 2-min timed session, upsell modal, share snippets, upgrade pricing with Stripe checkout).
- `POST /api/generate-therapy`: Free template-based therapy endpoint for the viral page (no tokens required). Returns randomized therapy responses with deeply in-character templates for work, love, money, stress, family, health, loneliness, sleep, and self-esteem topics. Each therapist has 8+ unique templates with topic-specific variants. Sophia uses validation, grounding exercises, breathing prompts, inner child work, attachment theory, IFS parts work, emotional naming, body scans, and compassionate witnessing. James uses CBT thought records, cognitive distortion audits, behavioral experiments, Socratic questioning, cost-benefit analysis, downward arrow technique, SMART goals, and probability estimation. Trump uses deal-making metaphors, winning/losing framing, self-referencing anecdotes, and signature phrases. Supports multi-round follow-up conversations with in-character probing questions. Accepts `voice` parameter (`trump`, `sophia`, `james`).
- `GET /therapy-multi`: Serves standalone multi-voice therapy landing page with 3 therapist voices (Dr. Trump, Dr. Sophia, Dr. James), voice selection with portrait photos, mid-session voice switching, TTS playback, follow-up conversations, share snippets, upsell modal, Stripe checkout, therapist background watermark images during sessions, session header portraits, and audio feedback on all interactive elements.
- `POST /api/track-viral`: Logs viral session events (session_start, session_complete, share, debate_started, vote_cast, debate_shared) for analytics.
- `GET /financial-faceoff`: Serves standalone Financial Faceoff viral debate page — 7 financial personas (Trump, Buffett, Elon, Suze Orman, Dave Ramsey, Grandma, AI Robot) debate 8 financial topics (Bitcoin, Dogecoin, Ethereum, Tesla, Apple, VTI, Gold, Real Estate). Features side-by-side debate cards, server-side voting with live progress bars, social sharing (Twitter/X, Facebook, clipboard), affiliate links per persona, vote encouragement toasts, and legal disclaimer.
- `POST /api/faceoff/vote`: Records votes for financial faceoff debates. Accepts `{ debateId, asset, persona1, persona2, votedFor }`, validates votedFor is a debate participant, stores in-memory (1000 entry limit), returns `{ votes, total }`.
- `GET /api/faceoff/votes/:debateId`: Returns current vote totals for a faceoff debate.
- Financial Faceoff in-app screen (`app/faceoff.tsx`): React Native screen with horizontal asset picker pills, persona selector cards, animated debate arena, voting with progress bars, sharing via React Native Share API. Accessible from home screen orange "FACEOFF" button.
- Trump Realty multi-persona advisors (`app/real-estate.tsx`): Property search page now includes 7 selectable financial advisors (Trump, Buffett, Suze, Grandma, Elon, Dave, Mansa Musa). Each advisor provides in-character property commentary, custom ratings, and persona-colored stamps. Advisor selector shown as horizontal pill buttons above property results. Backend returns `personaComments` object with all 7 personas' analysis per property.

The backend leverages OpenAI for chat completions and transcription, and Fish Audio for text-to-speech with a cloned Trump voice, Dr. Sophia's voice (Fish Audio ID: `193c58af62ea487180baacdef8a69bbd`), and Dr. James's voice (Fish Audio ID: `03397b4c4be74759b72533b663fbd001`, speed 0.9). It also handles static serving of pre-built Expo web assets in production.

## External Dependencies

- **OpenAI API**: Utilized for AI chat completions (gpt-5.2), audio transcription (Whisper), and potentially audio generation (gpt-audio).
- **ElevenLabs API**: Used for advanced text-to-speech functionalities, including voice cloning and generating theme intros.
- **Fish Audio API**: Provides text-to-speech capabilities, including a cloned Trump voice, Dr. Sophia's voice (ID: `193c58af62ea487180baacdef8a69bbd`, speed 0.95), and Dr. James's voice (ID: `03397b4c4be74759b72533b663fbd001`, speed 0.9), with mood-based speed adjustments.
- **@react-native-async-storage/async-storage**: Client-side persistent storage for conversation data.
- **Expo Services**: Used for various mobile functionalities like font loading, haptics, linear gradients, and splash screen management.
- **RevenueCat (`react-native-purchases`)**: Integrated for managing in-app subscriptions and purchases.
- **RSS Feeds**: Utilized for fetching real-time news headlines (MarketWatch, CNBC, NYT, BBC, Fox News).
- **Open-Meteo API**: Provides weather forecast data.
- **CoinGecko API / Yahoo Finance**: Used for fetching live market prices for cryptocurrencies and other assets.
- **Amazon Associates**: Affiliate monetization using tag `trumpbot-20` with "Trump's Picks" product recommendations and auto-linking script.

## Future Considerations

- **DeepSeek AI as cost alternative**: DeepSeek V3/R1 is roughly 8-10x cheaper than OpenAI GPT for token costs. Consider switching some or all AI features to DeepSeek when cost optimization becomes a priority. Main chat persona may benefit from staying on GPT for quality, while simpler features (news commentary, daily challenges, hot takes) could move to DeepSeek first.