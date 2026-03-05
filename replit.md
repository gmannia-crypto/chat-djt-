# Chat DJT

## Overview

Chat DJT is a mobile-first AI chat application built with Expo (React Native) designed for interactive conversations with an AI impersonating Donald Trump. The project aims to deliver a unique experience through a luxury dark/gold UI, real-time streaming chat responses, and local conversation persistence. It incorporates subscription-based monetization and an admin interface for revenue management, targeting a broad audience interested in political satire and AI interaction. Key capabilities include Trump-themed therapy sessions, financial debates with various personas, and Trump-centric real estate analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

The application is developed with Expo SDK 54, using `expo-router` for routing and `react-native-reanimated` for animations. It features a stack-based navigation for core functionalities like chat, subscription, and admin. State management utilizes React Query for server data and React's built-in hooks for local UI state. Conversations are locally persisted with AsyncStorage. Real-time chat responses are handled via Server-Sent Events (SSE). The UI adheres to a dark theme with gold accents and PlayfairDisplay fonts, supporting iOS, Android, and web platforms with a dark mode-only aesthetic. It includes interactive elements like pulsating CTA buttons, a 24-hour mystery box with reward types, and keyboard handling via `react-native-keyboard-controller`. Dedicated screens for multi-persona therapy, financial face-offs, and real estate analysis are implemented, each with specific UI elements and interactions like therapist selectors, debate arenas, voting mechanisms, and property advisors. Photorealistic AI-generated persona images are stored at `assets/images/persona-{id}.png` for all 11 active personas (trump, buffett, musk, suze, dave, grandma, genie, mansa, jordan, bernie, ruckus) plus robot. The home screen features a badges/achievements system tracking 9 badges via AsyncStorage (streak milestones, conversation counts, mystery box opens, Trump ratings, explorer status), a streak share button (Twitter/X on web, native Share on mobile), and a live activity wall.

### Backend (Express)

The backend is an Express 5 API gateway providing various endpoints for AI interactions, content generation, and utility functions. It serves:
- **AI Chat & TTS**: Streams Trump-persona responses via SSE using OpenAI (gpt-5.2) and converts text to speech using ElevenLabs and Fish Audio APIs (with Trump, Sophia, and James voices). It also handles audio transcription using OpenAI Whisper.
- **Content Generation**: Generates Trump-voice theme intros, news commentary, market hot takes, prophecies, daily challenges, Truth Social reactions, cabinet commentary, and weather commentary.
- **Therapy System**: Supports token-gated AI therapy sessions with multiple therapist personas (Trump, Sophia, James), multi-round follow-up conversations, template-based free therapy for viral pages, and integrates with Stripe for checkout.
- **Financial & Debate Features**: Manages financial face-off debates with multiple personas, including voting, leaderboards, and a "Persona of the Week" voting system. It also provides AI-powered property analysis using OpenAI with persona-specific commentary and generates mortgage calculations with Trump's insights.
- **Analytics & Monetization**: Tracks app share events, viral session events, and integrates with Stripe for therapy session payments.
- **Static Asset Serving**: Serves pre-built Expo web assets in production.

## External Dependencies

- **OpenAI API**: Used for AI chat completions (gpt-5.2), audio transcription (Whisper), and AI-powered property analysis (gpt-4o-mini).
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

## Persona Dialogue Styles

- **Bernie Mac**: Speaks in casual Black English style — uses "ain't finna", "yo", "wit'", "gon'", "talkin' bout", "sheeeeit", "Don't be out here actin' a fool", etc.
- **Uncle Ruckus**: Speaks in Black southern slang style — uses "I tell you what", "dadgum", "'fore", "reckon", "lemme", "fixin' to", "prolly", "no sir", "that there", etc.