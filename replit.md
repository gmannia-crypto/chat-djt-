# Chat DJT

## Overview

Chat DJT is a mobile-first AI chat application built with Expo (React Native) that enables users to engage in conversations with an AI impersonating Donald Trump. The project aims to provide a unique, interactive experience with a distinct luxury dark/gold UI, real-time streaming chat responses, and local conversation persistence. It includes features for monetization through subscriptions and an admin interface for revenue management, targeting a broad market interested in political satire and AI interaction.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

The application is built with Expo SDK 54, utilizing `expo-router` for file-based routing and `react-native-reanimated` for animations. Navigation is stack-based, supporting screens for home, chat, subscription, and admin functionalities. State management for server data is handled by React Query, while local UI state uses React's built-in capabilities. Conversations and messages are persisted client-side using AsyncStorage. The client consumes Server-Sent Events (SSE) for streaming chat responses, parsing data lines to update the UI in real-time. The UI features a dark theme with gold accents and PlayfairDisplay fonts, targeting iOS, Android, and web platforms with a dark mode-only aesthetic. Keyboard handling is managed by `react-native-keyboard-controller`.

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
- `POST /api/therapy`: Generates Trump-style therapy responses as "Dr. Trump" based on name, problem, and seriousness level (token-gated). Includes template-based fallback if AI fails.
- Therapy page features: cinematic intro animation, Trump therapist background image, speech-to-text input (mic button), "Dr. Trump's RX" Amazon affiliate product recommendations (health/wellness supplements with `trumpbot-20` tag).
- `GET /therapy-viral`: Serves standalone viral therapy landing page (3-question flow, 2-min timed session, upsell modal, share snippets, upgrade pricing with Stripe checkout).
- `POST /api/generate-therapy`: Free template-based therapy endpoint for the viral page (no tokens required). Returns randomized Trump-style therapy responses with context-aware templates for work, love, money, stress, family, and health topics.
- `POST /api/track-viral`: Logs viral session events (session_start, session_complete, share) for analytics.

The backend leverages OpenAI for chat completions and transcription, and Fish Audio for text-to-speech with a cloned Trump voice. It also handles static serving of pre-built Expo web assets in production.

## External Dependencies

- **OpenAI API**: Utilized for AI chat completions (gpt-5.2), audio transcription (Whisper), and potentially audio generation (gpt-audio).
- **ElevenLabs API**: Used for advanced text-to-speech functionalities, including voice cloning and generating theme intros.
- **Fish Audio API**: Provides text-to-speech capabilities, including a cloned Trump voice, with mood-based speed adjustments.
- **@react-native-async-storage/async-storage**: Client-side persistent storage for conversation data.
- **Expo Services**: Used for various mobile functionalities like font loading, haptics, linear gradients, and splash screen management.
- **RevenueCat (`react-native-purchases`)**: Integrated for managing in-app subscriptions and purchases.
- **RSS Feeds**: Utilized for fetching real-time news headlines (MarketWatch, CNBC, NYT, BBC, Fox News).
- **Open-Meteo API**: Provides weather forecast data.
- **CoinGecko API / Yahoo Finance**: Used for fetching live market prices for cryptocurrencies and other assets.
- **Amazon Associates**: Affiliate monetization using tag `trumpbot-20` with "Trump's Picks" product recommendations and auto-linking script.

## Future Considerations

- **DeepSeek AI as cost alternative**: DeepSeek V3/R1 is roughly 8-10x cheaper than OpenAI GPT for token costs. Consider switching some or all AI features to DeepSeek when cost optimization becomes a priority. Main chat persona may benefit from staying on GPT for quality, while simpler features (news commentary, daily challenges, hot takes) could move to DeepSeek first.