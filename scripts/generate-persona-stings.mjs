import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'assets', 'sounds', 'stings');

const BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

if (!BASE_URL || !API_KEY) {
  console.error('Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY');
  process.exit(1);
}

const personas = [
  {
    id: 'rfk',
    voice: 'shimmer',
    instruction: 'Speak in a gravelly, slightly hoarse, conspiratorial whisper — like a man who has seen too much.',
    line: 'A worm ate part of my brain.',
  },
  {
    id: 'alexjones',
    voice: 'onyx',
    instruction: 'Speak with extreme urgency, shouting like a conspiracy radio host in full meltdown.',
    line: "They're turning the friggin' frogs gay!",
  },
  {
    id: 'obama',
    voice: 'echo',
    instruction: 'Speak with calm, measured, presidential gravitas — slow and deliberate.',
    line: 'Let me be clear.',
  },
  {
    id: 'melania',
    voice: 'nova',
    instruction: 'Speak with a cool, detached, Slovenian-accented tone — utterly unbothered.',
    line: "I really don't care, do u?",
  },
  {
    id: 'schumer',
    voice: 'fable',
    instruction: 'Speak in a forceful, nasally New York senatorial voice — indignant and self-righteous.',
    line: 'I rise in strong opposition.',
  },
  {
    id: 'odonnell',
    voice: 'ash',
    instruction: 'Speak like a cable news anchor — smooth, authoritative, ready to deliver a ten-minute monologue.',
    line: 'Let me explain.',
  },
  {
    id: 'kamala',
    voice: 'coral',
    instruction: 'Speak with enthusiastic, slightly sing-song delivery — followed by a brief chuckle.',
    line: 'You think you just fell out of a coconut tree?',
  },
  {
    id: 'mtg',
    voice: 'sage',
    instruction: 'Speak with absolute conviction and rising outrage — like someone who has just cracked the ultimate conspiracy.',
    line: 'It was the space lasers!',
  },
];

async function generateSting(persona) {
  const url = `${BASE_URL}/chat/completions`;

  const body = {
    model: 'gpt-audio-mini',
    modalities: ['text', 'audio'],
    audio: { voice: persona.voice, format: 'mp3' },
    messages: [
      {
        role: 'system',
        content: `You are a voice actor. ${persona.instruction} Deliver only the exact line given — nothing more, no intro, no outro.`,
      },
      {
        role: 'user',
        content: `Say this line exactly: "${persona.line}"`,
      },
    ],
    max_tokens: 200,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const audioB64 = data.choices?.[0]?.message?.audio?.data;
  if (!audioB64) {
    throw new Error(`No audio data returned. Response: ${JSON.stringify(data).slice(0, 400)}`);
  }

  const buffer = Buffer.from(audioB64, 'base64');
  const outPath = join(outDir, `${persona.id}.mp3`);
  await writeFile(outPath, buffer);
  console.log(`✓ ${persona.id}.mp3 (${buffer.length} bytes)`);
}

async function main() {
  console.log(`Generating ${personas.length} persona stings...`);
  for (const p of personas) {
    try {
      await generateSting(p);
    } catch (err) {
      console.error(`✗ ${p.id}: ${err.message}`);
    }
  }
  console.log('Done.');
}

main();
