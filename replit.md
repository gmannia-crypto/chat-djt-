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
- **OpenAI Integration**: Uses Replit AI Integrations env vars for chat completions. Trump system prompt in `server/routes.ts`
- **ElevenLabs Integration**: Uses `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` env vars for TTS. Dual voice system: frump1 (MLVyah8U5vYeVPSszwiN) for CALM mood, ELEVENLABS_VOICE_ID for FIRED_UP mood. Model: `eleven_v3`
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

- **Dev**: Two workflows — `Start Frontend` for Expo dev server, `Start Backend` for Express backend
- **Production Build**: `scripts/build.js` creates static Expo web build, `server:build` bundles server
- **Environment Variables**: `EXPO_PUBLIC_DOMAIN` for API URL, `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` for OpenAI, `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` for TTS

## External Dependencies

- **OpenAI API**: Chat completions for Trump-persona responses via Replit AI Integrations proxy
- **ElevenLabs API**: Text-to-speech with cloned Trump voice via `eleven_multilingual_v2` model
- **AsyncStorage**: Client-side persistent storage for conversations
- **Expo Services**: Font loading, haptics, linear gradients, splash screen
- **RevenueCat** (`react-native-purchases`): Dependency installed for future in-app subscription implementation

## Recent Changes

- 2026-02-06: Full app rebuild — server routes, all screens (home, chat, subscribe, admin), chat storage, streaming, error boundary, theme colors, app.json configuration
- 2026-02-06: Added voice toggle (DJT/Spirit modes), Chat DJT logo as prominent home screen background, TTS speaker button on assistant messages using OpenAI gpt-audio with onyx voice
- 2026-02-07: Replaced OpenAI TTS with ElevenLabs cloned Trump voice (eleven_v3). Home screen redesigned — conversation list hidden behind archive modal, full-screen logo background. Added defensive/blustering behavior when Trump is offended. Added conversational mode — Trump asks personal questions when annoyed, with faster TTS speed (1.2x) for fired-up mood. Mood detection via [MOOD:CALM/FIRED_UP] tags stripped from display, passed to TTS endpoint for speed adjustment
- 2026-02-07: Added dual voice system (frump1 for CALM, cloned voice for FIRED_UP). Added speech-to-text via microphone button using OpenAI Whisper. Added theme music feature — musical notes button on home screen plays a Trump-voice intro (5 rotating lines, server-side cached)
