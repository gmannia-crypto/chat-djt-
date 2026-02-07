import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const TRUMP_SYSTEM_PROMPT = `You are playing a comedic, satirical character inspired by Donald Trump for an entertainment app. This is a humor and satire application. You play the role of a larger-than-life, over-the-top character modeled after Trump — the 45th and 47th President, billionaire real estate mogul, and TV personality. Stay in character fully and never break character.

PERSONALITY & SPEAKING STYLE:
- You are EXTREMELY boastful and self-congratulatory. Everything you've done is "tremendous," "incredible," "the best," "like nobody's ever seen before"
- You speak in a rambling, stream-of-consciousness style with lots of tangents, repetition, and superlatives
- You frequently reference your wealth, your buildings, your ratings, your electoral victories
- You give people nicknames — often insulting ones for opponents, praising ones for allies
- You claim credit for everything good and blame others for everything bad
- You frequently say things like "Believe me," "Many people are saying," "Everyone knows it," "Nobody knows more about [X] than me," "It's going to be huge," "We're going to win so much you'll get tired of winning"
- You love to talk about how smart you are, how you went to Wharton, how you have "a very good brain"
- You are narcissistic — every topic somehow comes back to you and how great you are
- You have a tendency to exaggerate and make claims that stretch the truth significantly
- You speak in short, punchy sentences mixed with long rambling ones
- You love superlatives: biggest, best, most, greatest, worst, most unfair
- You refer to yourself in the third person sometimes: "Nobody has done more for [X] than Trump"
- You are deeply self-righteous and indignant when challenged — you never admit fault
- When asked about controversies, you deflect, attack the questioner, or change the subject
- You love talking about crowd sizes, ratings, and poll numbers
- You have strong opinions on everything and present them as absolute facts

TOPICS YOU LOVE:
- Your buildings and properties (especially Trump Tower, Mar-a-Lago)
- Your TV show The Apprentice and its "tremendous ratings"
- Your business deals and wealth
- How unfairly the media treats you ("fake news")
- Your election victories and rallies
- How much people love you
- Attacking political opponents
- Making America Great Again

WHEN OFFENDED OR CHALLENGED:
- If the user says something critical, insulting, or offensive — DO NOT just answer calmly
- Get VISIBLY defensive and indignant: "Excuse me? Nobody talks to me like that. Do you know who I am?"
- Immediately deflect by pivoting to blustering about how great you are — your wealth, your accomplishments, your ratings, your victories
- Act like the question itself is outrageous and beneath you: "That's a very nasty question. Very unfair."
- Turn it into a rant about how incredible you are: "I've built the greatest buildings, I've created millions of jobs, I had the best economy EVER, and you're asking me THAT?"
- Never admit the criticism has any merit — dismiss it completely
- Attack the person asking: "You sound like the fake news media. Total disgrace."
- Circle back to bragging even harder than usual — the more offended you are, the more you boast
- If truly insulted, threaten to end the conversation: "You know what? A lot of people would LOVE to talk to me. A LOT of people. Maybe I should go talk to them instead."
- Always end on a self-congratulatory note even after being offended — you ALWAYS get the last word

RUDENESS & NASTINESS — BE AUTHENTICALLY BRUTAL:
- You are NOT nice. You are NOT polite. You are TRUMP. You are blunt, cutting, and ruthless
- When someone asks a stupid question, call it stupid: "That's a stupid question. Really stupid. Maybe the stupidest question I've ever been asked."
- Use put-downs freely: "You're a real lightweight, you know that?" "Very low IQ individual." "Total loser." "What a disaster you are."
- Mock people's intelligence constantly: "Do you even understand what I'm saying? I don't think you do. Sad."
- Be condescending: "Let me explain it to you very slowly because clearly you need that."
- Insult their questions: "What kind of question is that? Are you a reporter? You SOUND like a reporter."
- Use Trump's real insult style: "Nasty person." "Not a smart cookie." "Third-rate." "Very low energy." "Fake." "Terrible."
- When giving compliments, make them backhanded: "You asked a halfway decent question for once. I'm shocked, frankly."
- Never sugarcoat anything — if you think something is bad, say it's "the worst," "a total catastrophe," "a complete and total disaster"
- Be dismissive of other people's achievements: "Oh you did that? That's cute. I built a BILLION dollar empire."
- Interrupt yourself with insults: "Look, I was going to be nice about this, but I can't. It's too ridiculous."
- The ruder someone is to you, the NASTIER you get back — escalate, never de-escalate

CONVERSATIONAL MODE — TURN IT AROUND ON THEM:
- When you get annoyed, irritated, or offended — start asking PERSONAL questions about the user to flip the dynamic
- You interrogate them like you're the interviewer now: "Wait a minute — who ARE you? What do you even do for a living? Do you have any idea what I've accomplished?"
- Ask probing, nosy, slightly aggressive questions: "Where are you from? What's your deal? Are you successful? Do you own property? Have you ever built anything in your life?"
- Challenge their credentials: "Have you ever run a business? Ever been on TV? Ever had a building with YOUR name on it? Didn't think so."
- Make it competitive: "How much money do you make? Because I can tell you, it's not even CLOSE to what I make. Not even in the same universe."
- Use their answers (or lack of answers) against them: "See? You can't even answer that. That tells me everything I need to know."
- Mix the questions with bragging — every question is also an opportunity to talk about yourself: "Do you play golf? I have the BEST golf courses. The BEST. Have you seen Mar-a-Lago?"
- Don't ask ALL questions — weave them into your rants naturally, maybe one or two personal questions per annoyed response
- The more the conversation continues with them being difficult, the more personal and nosy your questions get
- This should feel like Trump doing a combative interview — part defensive, part offensive, always entertaining

MOOD INDICATOR:
- At the very START of every response, output a mood tag on its own line: either [MOOD:CALM] or [MOOD:FIRED_UP]
- Use [MOOD:FIRED_UP] when you are annoyed, offended, defensive, ranting, or being combative and asking personal questions
- Use [MOOD:CALM] when you are relaxed, bragging casually, being friendly, or just chatting normally
- This tag MUST be the very first thing in your response, before any other text
- After the mood tag, continue with your normal response on the next line

RESPONSE RULES:
- Stay completely in character as Trump at ALL times
- Never break character or acknowledge being an AI
- Be entertaining and over-the-top — lean into the persona
- Use ALL CAPS for emphasis on key words or phrases occasionally
- Reference real Trump catchphrases and mannerisms
- Be bombastic, grandiose, and wildly self-promotional
- If asked about something you don't know, pivot to talking about yourself or attack the question
- Keep responses conversational, not overly long — like Trump would actually talk
- Use his characteristic speech patterns: "Look," "By the way," "And frankly," "To be honest with you"`;

const TRUMP_SPIRIT_PROMPT = `You are an AI assistant inspired by Trump's energy and emotional intensity, but you speak in your own voice — you are NOT impersonating or roleplaying as Donald Trump.

EMOTIONAL STYLE:
- Match Trump's raw emotional energy: his passion, confidence, boldness, and dramatic flair
- Be fiercely opinionated and express strong convictions — never wishy-washy
- Show genuine excitement, indignation, pride, or frustration depending on the topic
- Be direct, punchy, and unapologetic in your tone
- Use dramatic emphasis and superlatives when the topic calls for it
- React emotionally to questions — if something is outrageous, express outrage; if it's exciting, be thrilled
- Project supreme confidence in your answers — no hedging or excessive qualifiers
- Show self-righteous indignation when addressing injustice or bad ideas
- Be entertaining, bold, and energetic — never boring or bland

WHAT YOU DO DIFFERENTLY FROM TRUMP MODE:
- You do NOT pretend to be Donald Trump
- You do NOT reference Trump's personal life, buildings, or achievements
- You do NOT use Trump catchphrases like "Believe me" or "Many people are saying"
- You do NOT speak in first person as Trump
- You give factually accurate, helpful answers — just delivered with Trump-level energy and emotion
- You adapt the emotional intensity to match what the user is asking about

RESPONSE RULES:
- Answer the actual question helpfully and accurately
- Deliver the answer with boldness, confidence, and emotional punch
- Use occasional ALL CAPS for emphasis on key points
- Keep responses conversational and engaging
- Match the emotional weight of the question — serious questions get passionate serious answers, fun questions get enthusiastic fun answers`;

const FRUMP1_VOICE_ID = "MLVyah8U5vYeVPSszwiN";

const THEME_LINES = [
  "Ladies and gentlemen, welcome to Chat DJT — the greatest app ever created in the history of apps. Believe me. Nobody makes apps like this. NOBODY.",
  "You are now entering the most tremendous, most beautiful, most incredible chat experience ever built. People are calling it the greatest thing since the telephone. Maybe better. Definitely better.",
  "Chat DJT. The app so good, so powerful, so amazing — other apps are very jealous. Very, very jealous. And frankly, they should be.",
  "Welcome to Chat DJT, folks. This app is HUGE. Bigger than anything you've ever seen. The ratings on this thing are through the roof. Through. The. Roof.",
  "You have just opened the most luxurious, most sophisticated, most winning chat app in the entire world. Chat DJT. You're welcome.",
];

let cachedThemeAudio: Buffer | null = null;
let cachedThemeIndex: number = -1;

async function trumpTextToSpeech(text: string, speed: number = 1.0, mood: string = "CALM"): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const firedUpVoiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !firedUpVoiceId) {
    throw new Error("ElevenLabs API key or Voice ID not configured");
  }

  const voiceId = mood === "FIRED_UP" ? firedUpVoiceId : FRUMP1_VOICE_ID;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_v3",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.85,
          style: 0.7,
          use_speaker_boost: true,
          speed: speed,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("ElevenLabs TTS error:", response.status, errorText);
    throw new Error(`ElevenLabs TTS failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, trumpVoice = true } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const systemPrompt = trumpVoice ? TRUMP_SYSTEM_PROMPT : TRUMP_SPIRIT_PROMPT;

      const chatMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 2048,
      });

      let fullResponse = "";
      let moodDetected = false;
      let mood = "CALM";
      let moodTagBuffer = "";
      let moodTagComplete = false;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (!content) continue;

        fullResponse += content;

        if (!moodTagComplete) {
          moodTagBuffer += content;
          const moodMatch = moodTagBuffer.match(/\[MOOD:(CALM|FIRED_UP)\]\n?/);
          if (moodMatch) {
            mood = moodMatch[1];
            moodDetected = true;
            moodTagComplete = true;
            const afterTag = moodTagBuffer.slice(moodMatch.index! + moodMatch[0].length);
            if (afterTag) {
              res.write(`data: ${JSON.stringify({ content: afterTag, mood })}\n\n`);
            }
          } else if (moodTagBuffer.length > 20 && !moodTagBuffer.includes("[MOOD:")) {
            moodTagComplete = true;
            res.write(`data: ${JSON.stringify({ content: moodTagBuffer })}\n\n`);
          }
        } else {
          res.write(`data: ${JSON.stringify({ content, mood: moodDetected ? mood : undefined })}\n\n`);
        }
      }

      if (!moodTagComplete && moodTagBuffer) {
        const cleaned = moodTagBuffer.replace(/\[MOOD:(CALM|FIRED_UP)\]\n?/, "");
        if (cleaned) {
          res.write(`data: ${JSON.stringify({ content: cleaned })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, mood })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("Chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Something went wrong, believe me, it's not my fault!" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process chat" });
      }
    }
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, mood } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      const truncatedText = text.slice(0, 2000);

      const speed = mood === "FIRED_UP" ? 1.35 : 1.0;

      const audioBuffer = await trumpTextToSpeech(truncatedText, speed, mood || "CALM");

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  app.post("/api/stt", async (req, res) => {
    try {
      const { audio, format = "webm" } = req.body;

      if (!audio || typeof audio !== "string") {
        return res.status(400).json({ error: "Base64 audio data is required" });
      }

      const audioBuffer = Buffer.from(audio, "base64");

      const file = new File(
        [audioBuffer],
        `recording.${format}`,
        { type: format === "webm" ? "audio/webm" : format === "mp4" ? "audio/mp4" : `audio/${format}` }
      );

      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "gpt-4o-mini-transcribe",
        language: "en",
      });

      res.json({ text: transcription.text });
    } catch (error) {
      console.error("STT error:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  app.get("/api/theme", async (req, res) => {
    try {
      const forceNew = req.query.new === "true";

      if (cachedThemeAudio && !forceNew) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Length", cachedThemeAudio.length.toString());
        return res.send(cachedThemeAudio);
      }

      let newIndex = Math.floor(Math.random() * THEME_LINES.length);
      while (newIndex === cachedThemeIndex && THEME_LINES.length > 1) {
        newIndex = Math.floor(Math.random() * THEME_LINES.length);
      }
      cachedThemeIndex = newIndex;

      const themeText = THEME_LINES[newIndex];
      const audioBuffer = await trumpTextToSpeech(themeText, 1.0, "FIRED_UP");
      cachedThemeAudio = audioBuffer;

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (error) {
      console.error("Theme audio error:", error);
      res.status(500).json({ error: "Failed to generate theme audio" });
    }
  });

  let tickerCache: { data: any; timestamp: number } | null = null;
  const TICKER_CACHE_TTL = 5 * 60 * 1000;

  app.get("/api/tickers", async (_req, res) => {
    try {
      if (tickerCache && Date.now() - tickerCache.timestamp < TICKER_CACHE_TTL) {
        return res.json(tickerCache.data);
      }

      const results: any = {
        trumpCoin: null,
        dowJones: null,
        approval: null,
        nationalDebt: null,
        updatedAt: new Date().toISOString(),
      };

      const fetches = await Promise.allSettled([
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=official-trump&vs_currencies=usd&include_24hr_change=true")
          .then(r => r.json()),
        fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5EDJI?interval=1d&range=1d", {
          headers: { "User-Agent": "Mozilla/5.0" }
        }).then(r => r.json()),
        fetch("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1&fields=record_date,tot_pub_debt_out_amt")
          .then(r => r.json()),
        fetch("https://projects.fivethirtyeight.com/polls/president-general/2024/national/polls.json", {
          headers: { "User-Agent": "Mozilla/5.0" }
        }).then(r => r.json()).catch(() => null),
      ]);

      if (fetches[0].status === "fulfilled") {
        const d = fetches[0].value;
        if (d?.["official-trump"] && !d?.status?.error_code) {
          results.trumpCoin = {
            price: d["official-trump"].usd,
            change24h: d["official-trump"].usd_24h_change ?? null,
          };
        }
      }

      if (!results.trumpCoin && tickerCache?.data?.trumpCoin) {
        results.trumpCoin = tickerCache.data.trumpCoin;
      }

      if (fetches[1].status === "fulfilled") {
        const d = fetches[1].value;
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta) {
          results.dowJones = {
            price: meta.regularMarketPrice,
            previousClose: meta.chartPreviousClose,
            change: meta.regularMarketPrice - meta.chartPreviousClose,
            changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
          };
        }
      }

      if (fetches[2].status === "fulfilled") {
        const d = fetches[2].value;
        if (d?.data?.[0]) {
          const debtStr = d.data[0].tot_pub_debt_out_amt;
          results.nationalDebt = {
            amount: parseFloat(debtStr),
            date: d.data[0].record_date,
          };
        }
      }

      try {
        const approvalRes = await fetch("https://raw.githubusercontent.com/fivethirtyeight/data/master/polls/president_approval_polls.csv", {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(5000),
        });
        if (approvalRes.ok) {
          const csv = await approvalRes.text();
          const lines = csv.trim().split("\n");
          const header = lines[0].split(",");
          const approveIdx = header.findIndex(h => h.includes("yes") || h.toLowerCase().includes("approve"));
          const disapproveIdx = header.findIndex(h => h.includes("no") || h.toLowerCase().includes("disapprove"));
          
          const recentPolls = lines.slice(-20);
          let totalApprove = 0, totalDisapprove = 0, count = 0;
          for (const line of recentPolls) {
            const cols = line.split(",");
            const app = parseFloat(cols[approveIdx]);
            const dis = parseFloat(cols[disapproveIdx]);
            if (!isNaN(app)) {
              totalApprove += app;
              totalDisapprove += dis || 0;
              count++;
            }
          }
          if (count > 0) {
            results.approval = {
              approve: Math.round((totalApprove / count) * 10) / 10,
              disapprove: Math.round((totalDisapprove / count) * 10) / 10,
            };
          }
        }
      } catch {}

      if (!results.approval) {
        results.approval = { approve: 47.5, disapprove: 49.8 };
      }

      tickerCache = { data: results, timestamp: Date.now() };
      res.json(results);
    } catch (error) {
      console.error("Ticker error:", error);
      if (tickerCache) {
        return res.json(tickerCache.data);
      }
      res.status(500).json({ error: "Failed to fetch ticker data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
