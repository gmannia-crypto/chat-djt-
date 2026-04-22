# Chat DJT

## Overview
Chat DJT is an Expo (React Native) mobile-first AI chat application offering interactive conversations with an AI impersonating Donald Trump. It features a luxury dark/gold UI, real-time streaming chat responses, local conversation persistence, and a subscription-based monetization model. The project aims to provide a unique and engaging user experience through specialized AI interactions and themed content, including Trump-themed therapy, financial debates, real estate analysis, a digital collectible card system, and a political arena for AI persona debates.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)
The application is built with Expo SDK 54, utilizing `expo-router` for navigation and `react-native-reanimated` for animations. It employs a stack-based navigation system, manages state with React Query for server data, and React hooks for local UI state. Conversation persistence is handled via AsyncStorage. Real-time chat responses are delivered using Server-Sent Events (SSE). The UI features a dark theme with gold accents and PlayfairDisplay fonts, supporting iOS, Android, and web platforms with a dark mode-only aesthetic. Key features include badges/achievements, a streak share button, a live activity wall, and a persona memory system. Dedicated screens support multi-persona therapy, financial face-offs, real estate analysis ("Trump Reality"), and "Trump's Sports Book," which includes live game data, AI-generated persona picks with debate analysis, a bet tally system, real-time live commentary, universal picks, user-named trash talk, and game-end countdowns with audio cues.

### Backend (Express)
The backend is an Express 5 API gateway responsible for AI interactions, content generation, and utility functions.
- **AI Chat & TTS**: Manages AI responses using OpenAI and text-to-speech conversion via ElevenLabs and Fish Audio APIs.
- **Content Generation**: Generates various Trump-voice themed content.
- **Therapy System**: Manages token-gated AI therapy sessions with Quick Session, Deep Session + PHQ-9, and Free Chat modes, featuring upfront token billing and personalized AI-generated questions. Enhanced therapist personas have unique worldviews, credentials, and personalities. A Shareable Diagnosis Plan feature generates structured treatment plans.
- **Trump Billionaires Game**: An AI-powered ethical choices simulator where players make decisions to reach $1 billion across dynamically generated industries, with Trump providing personalized AI voice analysis for each choice. Features server-side profit validation, deal streak bonuses, net worth milestones, random market events, and breaking news headlines.
- **Financial & Debate Features**: Orchestrates multi-persona financial debates, voting systems, leaderboards, AI property analysis, and Trump's Sports Book with individual persona picks per game and an "All Analyst Picks" grid.
- **Trump Reality (Real Estate)**: Offers Airbnb zone scoring, a color-coded Prospect Map with property categories and investment tiers, property search with AI advisor personas, and interactive AI guide conversations. Tour guide personas have dedicated Fish Audio voice IDs.
- **Sports Book Tabs**: The sportsbook uses a tabbed navigation system for organizing content, including a "DC Royal" tab featuring a live sports crawl ticker, a crown system for top-performing persona analysts, timed DC Royal debates (arena-style live debates between winning analysts with TTS speaking and upfront token billing), an all-time DC Royal crown leaderboard, league standings, Question of the Day (AI-generated sports trivia), and Player Stats Lookup.
- **Political Arena**: A real-time AI persona conversation engine with 20 political figures and 24 daily dynamic debate topics generated from live RSS headlines, plus custom user topic creation. It features token-gated timed debate sessions, news-aware personas with emotional reactions, a persona selector, poll voting, an interruption system, mid-debate breaking news banners, direct response queuing, cross-session persona memory, and user name/info memory. It also includes a "1-on-1 Interview Mode" screen for journalist-politician interviews.
- **Trump Counterattack System**: Automatically forces Trump as the next speaker if attacks on him are detected.
- **Persona Point Tally System**: Allows users to award points to personas, featuring a live mini-scoreboard and an AI-generated end-of-session roast.
- **Arena Win Tally System**: Tracks historical wins per user and globally, incorporating win records into persona prompts.
- **Global Arena Leaderboard**: Displays an all-time leaderboard of users and popular personas.
- **Arena Usage Rewards**: Provides automatic token rewards for time spent in the Arena.
- **Therapy Session Memory**: Server-side PostgreSQL storage of therapy sessions with sentiment analysis, topic extraction, and relationship tracking, with client-side AsyncStorage fallback.
- **Lip-Sync Video Generation**: Uses fal.ai SadTalker or Dreamface (DreamAPI by NewportAI) to generate lip-synced talking-head videos from therapist portraits + Fish Audio TTS, a premium token-gated feature.
- **Speech Pause System**: Manages pausing of TTS and conversation loops during user mic recording.
- **Arena Intro Animation**: Cinematic intro with voiceovers, animated persona chips, and a countdown.
- **Push Notifications**: Admin can send push notifications to all registered devices. Client auto-registers push tokens on first launch.
- **Analytics & Monetization**: Tracks user events and integrates with Stripe for payment processing, employing triple-redundancy for token fulfillment. RevenueCat (`react-native-purchases`) is used for in-app purchases and subscriptions.
- **Sports All-Time Records**: Persistent win/loss/streak tracking for sports, with auto-syncing to the server and an all-time leaderboard.
- **Live Sports Audio**: A radio-style module offering AI-generated play-by-play audio for live/upcoming/final games with persona commentators.
- **AI Model System**: Supports Premium (GPT-5.2 + GPT-4o-mini), Budget (DeepSeek V3), and Split AI model modes, with an admin interface for dynamic selection and cost estimation.
- **Token Win Celebration**: Video celebration modal plays on token purchase/subscription fulfillment.
- **DJT Collectibles**: A digital collectible card system with 24 cards across 6 categories and 4 rarity tiers, earned via a mystery box.
- **Engagement System**: Daily visit streak tracking, badge/achievement system (10 badges), shareable result cards with social sharing, and toast notifications.
- **Landing Page Event Architecture**: The landing page uses document-level event delegation with three listeners (click, input, keydown) on `.explore-section` routing events to active module methods.
- **Global Sound Toggle**: A floating sound toggle button appears on the main menu, therapy, and sports screens, using a React context with AsyncStorage persistence to suppress all TTS calls and UI sound effects when muted.
- **Company Website**: A static company website served at `/company` with privacy policy, terms of service, sitemap, and robots.txt.
- **HTML Standalone Pages**: Dedicated HTML pages for multi-persona therapy (`/therapy-multi`) and viral sharing therapy (`/therapy-viral`).
- **Menu Music System**: Menu music on the home screen auto-pauses when navigating to other screens and resumes upon return.
- **Arena Token Enforcement**: Implements a system for free debate API calls, daily free trials, and paid session access to manage user engagement.
- **Share App Templates**: Reusable `<ShareAppButton />` provides a global share button with pre-written templates for various app sections.

## External Dependencies
- **OpenAI API**: AI chat, audio transcription, and analysis.
- **ESPN API**: Live sports data.
- **ElevenLabs API**: Advanced text-to-speech and voice cloning.
- **Fish Audio API**: Persona-specific text-to-speech.
- **@react-native-async-storage/async-storage**: Client-side data persistence.
- **Expo Services**: Mobile-specific functionalities, including push notifications.
- **Expo Push API**: Server-side push notification delivery.
- **RevenueCat (`react-native-purchases`)**: In-app purchases and subscriptions.
- **RSS Feeds**: Real-time news headlines.
- **Open-Meteo API**: Weather forecast data.
- **CoinGecko API / Yahoo Finance**: Live market data.
- **Amazon Associates**: Affiliate monetization.
- **Alternative.me Fear & Greed API**: Live Crypto Fear & Greed Index.
- **Stripe**: Payment processing.
- **expo-file-system**: Audio file management on native platforms.
- **fal.ai**: SadTalker lip-sync video generation (fallback provider).
- **DreamFace (DreamAPI by NewportAI)**: Primary lip-sync video generation.