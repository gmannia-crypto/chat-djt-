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
- **Therapy System**: Manages token-gated AI therapy sessions and integrates with Stripe.
- **Financial & Debate Features**: Orchestrates multi-persona financial debates, voting systems, leaderboards, AI property analysis, and Trump's Sports Book with features like pre-game picks, March Madness bracketology (full bracket system, persona analysis, achievements, leaderboard), and specialized personas for Racing and Soccer categories.
- **Trump Reality (Real Estate)**: Offers a 3-tab layout for Airbnb zone scoring (Hot Zones), property search with AI advisor personas (Listings), and interactive AI guide conversations (Tour Guide).
- **Political Arena**: A real-time AI persona conversation engine with 13 political figures, dynamic news topics, token-gated access, news-aware personas with emotional reactions, a persona selector, poll voting, and a single interruption system. It features enhanced attacks on specific personas, a user join system with personalized greetings and floating input bar, voice mic input for user contributions, and directed persona responses when mentioned by name. Sessions are recorded and shareable.
- **Trump Counterattack System**: Detects attacks on Trump and forces him as the immediate next speaker.
- **Persona Point Tally System**: Users can award points to personas, with a live mini-scoreboard and an end-of-session summary including an AI-generated roast.
- **Speech Pause System**: Pauses persona TTS and conversation loop during user mic recording.
- **Arena Intro Animation**: Cinematic intro with voiceovers, animated persona chips, and countdown. Messages animate in with typewriter effect synced with TTS.
- **Analytics & Monetization**: Tracks user events and integrates with Stripe for payments.
- **Static Asset Serving**: Serves frontend assets, a landing page, and lazy-loaded feature module JS files from `/js/`.

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