# Chat DJT

## Overview

Chat DJT is a mobile-first AI chat application built with Expo (React Native) that provides interactive conversations with an AI impersonating Donald Trump. The project aims to offer a unique experience through a luxury dark/gold UI, real-time streaming chat responses, local conversation persistence, and subscription-based monetization. Key features include Trump-themed therapy, financial debates with various personas, real estate analysis, a digital collectible card system, and a political arena for AI persona debates.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

The application is built with Expo SDK 54, utilizing `expo-router` for navigation and `react-native-reanimated` for animations. It employs a stack-based navigation system for core functionalities. State management is handled by React Query for server data and React's built-in hooks for local UI state. Conversation persistence is managed via AsyncStorage. Real-time chat responses are delivered using Server-Sent Events (SSE). The UI features a dark theme with gold accents and PlayfairDisplay fonts, supporting iOS, Android, and web platforms with a dark mode-only aesthetic. It includes a badges/achievements system, a streak share button, a live activity wall, and a persona memory system for tracking interactions and generating dynamic dialogue. Dedicated screens support multi-persona therapy, financial face-offs, real estate analysis, and Trump's Sports Book, each with specialized UI and interaction logic. The Sports Book features live game data, AI-generated persona picks with debate analysis, and a bet tally system.

### Backend (Express)

The backend is an Express 5 API gateway responsible for AI interactions, content generation, and utility functions. It provides:
- **AI Chat & TTS**: Streams AI responses using OpenAI and converts text to speech via ElevenLabs and Fish Audio APIs, also handles audio transcription.
- **Content Generation**: Generates various Trump-voice themed content.
- **Therapy System**: Manages token-gated AI therapy sessions with multiple personas and integrates with Stripe for payments.
- **Financial & Debate Features**: Orchestrates multi-persona financial debates, voting systems, leaderboards, and AI-powered property analysis. It also powers Trump's Sports Book with AI persona picks and debates.
- **Political Arena**: A real-time AI persona conversation engine featuring 12 political figures (including Elon Musk with stuttering speech pattern, voice ID `03397b4c4be74759b72533b663fbd001`), with dynamic news topics (2-min cache, daily-fresh headlines), voice ON by default, token-gated access (5 free interactions, then 5 tokens for 5-min session), news-aware personas with persona-specific emotional reactions to breaking news, a persona selector (min 2, max 11 active debaters), poll voting with personalized thank-you TTS (bypasses token gating), detailed daily topics (AI-generated from live headlines, always includes Palestine/Zionist lobby and Epstein files topics), all opponents call the Iran war "The Epstein War", Galloway is the primary Palestine/anti-Zionism voice constantly blasting Netanyahu, and a single interruption system with sequential guard (isInterruptingRef prevents overlapping): personas can interrupt Trump (~35% chance). Trump no longer interrupts other speakers. Weighted random speaker selection with anti-repeat logic ensures all personas participate, with Trump getting a +40 weight bonus. **User Join System**: After 2 persona messages, a unified "Jump Into the Debate" modal appears with name/city/state/country fields and auto-dismiss countdown. On joining, a random persona welcomes them by name/location via TTS. Personas periodically ask the user questions (~40% chance every 5 messages) with a floating input bar. Users have a persistent chat bar to say anything or steer the conversation to new topics — the next persona reacts to whatever they type. Backend supports `isWelcome`, `askUser`, and `userContext` params for personalized interactions. User messages render with green (#4ADE80) styling and "YOU" badge. Race condition guard (`isAskingUserRef`) prevents duplicate question prompts. **Voice Mic Input**: Users can record their voice via mic button (expo-av on native, MediaRecorder on web), audio is transcribed via `/api/stt` (Whisper), and the recorded audio URI is stored with the message for playback. Voice messages show "VOICE" badge and mic icon. **Directed Persona Response**: When user mentions a persona by name/alias (e.g., "Trump", "Elon", "Bibi"), that specific persona responds immediately instead of random selection; conversation then continues normally. Alias mapping in `PERSONA_ALIASES` constant. Sessions are automatically recorded and saved to AsyncStorage (up to 20). **User voice playback in replay**: During replay, user voice messages play the original recorded audio instead of silence. Recordings are replayable via `app/arena-replay.tsx` with timeline slider, play/pause, speed controls. Sessions shareable to social media.
- **Trump Counterattack System**: `detectTrumpAttack()` detects when any opponent blames/attacks Trump with hostile keywords (felon, convicted, Epstein War, corrupt, etc.). When triggered, Trump is forced as the immediate next speaker (bypasses weighted random selection) and no one else speaks until he responds. Trump and Ruckus NEVER say "The Epstein War" — only opponents use that term. Backend enforces this via: system prompt instructions, topic description sanitization for Trump/Ruckus responses, and post-generation text replacement guard.
- **Arena Intro Animation**: Cinematic intro with nav voice (Fish Audio voice ID `121b31844d2f451a9838b15e6a329002`) saying "Political Arena" first, then persona chips fly in, then 5-second countdown "Five. Four. Three. Two. One.", then "Engage!" before transitioning to live debate. Voice sequencing is chained (title voice must finish before countdown starts, with 3s safety timeout). Features LIVE badge, title zoom-in, persona chips flying in from alternating sides, progress ring with color shifts (gold→yellow→red), haptic feedback. Unmount guards prevent audio leaks. Speaker delay between personas is 1.5-3.5s (normal pace). Messages animate in with SlideInLeft/SlideInRight with TypewriterText component that reveals persona message text word-by-word (~280ms/word) in sync with TTS voice when voice is enabled (only for latest message). Arena header, voice controls, stream container, and topic bar all have entry animations.
- **Analytics & Monetization**: Tracks user events and integrates with Stripe for payments.
- **Static Asset Serving**: Serves frontend assets and a landing page in production.

### AI Model System

The application supports three AI model modes: Premium (GPT-5.2 + GPT-4o-mini), Budget (DeepSeek V3), and Split (percentage-based routing between Premium and Budget). An admin interface allows for dynamic model selection and cost estimation. All AI chat completion calls dynamically route to the selected model tier.

### DJT Collectibles

A digital collectible card system with 24 cards across 6 categories and 4 rarity tiers. Cards are earned via a mystery box feature on the home screen, with progress tracked and displayed in a gallery.

## External Dependencies

- **OpenAI API**: For AI chat completions (gpt-5.2), audio transcription (Whisper), AI property analysis (gpt-4o-mini), and real-time AI persona sports picks (gpt-4o-mini).
- **ESPN API**: Provides live sports data for various leagues, including scores and odds.
- **ElevenLabs API**: For advanced text-to-speech and voice cloning.
- **Fish Audio API**: For text-to-speech with specific persona voices.
- **@react-native-async-storage/async-storage**: For client-side data persistence.
- **Expo Services**: For mobile-specific functionalities.
- **RevenueCat (`react-native-purchases`)**: For in-app subscription and purchase management.
- **RSS Feeds**: For real-time news headlines.
- **Open-Meteo API**: For weather forecast data.
- **CoinGecko API / Yahoo Finance**: For live market data.
- **Amazon Associates**: For affiliate monetization with the `trumpbot-20` tag.
- **Alternative.me Fear & Greed API**: For live Crypto Fear & Greed Index.
- **Stripe**: For payment processing.
- **expo-file-system**: For managing audio files on native platforms.