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
- **Political Arena**: A real-time AI persona conversation engine featuring 11 political figures with dynamic news topics (2-min cache, daily-fresh headlines), voice ON by default, token-gated access (2-min free trial + 30 free responses, then 3 tokens for 10-min session), news-aware personas with persona-specific emotional reactions to breaking news, a persona selector, poll voting with personalized thank-you TTS (bypasses token gating), and a dual interruption system: (1) Biden/Rosie/Galloway/BernieMac/Omar can interrupt Trump (~35% chance) with angry one-liners followed by Trump's clapback insult, and (2) Trump can interrupt other speakers (~30% chance) shouting "FAKE NEWS, folks! FAKE NEWS!" with aggressive attacks. Weighted random speaker selection with anti-repeat logic ensures all personas participate, with Trump getting a +25 weight bonus and reduced repeat penalties so he speaks more often. Trump is the CURRENT sitting president (knows he's in office, references executive actions). Biden is a FORMER president. Featured prominently on home screen with pulsating card and "TRY IT NOW FOR FREE" CTA. Trump voice ID: `3aa02e39286a4b29a46bb2d59427bbc2`, Galloway voice ID: `12206c42bd74465f987178e33c277d87`. Trump has specific aggressive dynamics toward Omar (deportation threats, calls her "illegal alien") and DESPISES Rosie O'Donnell (calls her a dog, bulldog comparisons, "hit by a truck from birth").
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