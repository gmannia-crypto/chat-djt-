# Debate Stage — Integration Kit

Your `interview.tsx` already IS 90% of the debate stage. Rather than rebuild it,
you'll **duplicate it** and add four things: the moderator, categories, the
AnimatedDebateFace portraits, and the cut-mic/call-in controls.

Nothing here touches your working interview screen. If anything breaks, your
original interview.tsx is untouched.

---

## STEP 0 — Files to add first
Put these in your project (already generated for you):
- `components/AnimatedDebateFace.tsx`
- `lib/debate-moderator.ts`

And save the 9 expression images in `assets/images/` (trump/ruckus/elon × 3).

---

## STEP 1 — Duplicate the interview screen
In Replit, copy `app/interview.tsx` → `app/debate-stage.tsx`.
Rename the default export function to `DebateStage`.
This instantly gives you a working 2-person interrupting debate at route
`/debate-stage`. Everything below is ADDING to that copy.

---

## STEP 2 — Imports (top of debate-stage.tsx, with the other imports)
```ts
import AnimatedDebateFace, { EXPRESSION_SOURCES, Mood } from "@/components/AnimatedDebateFace";
import {
  MODERATORS, ModeratorStyle, generateModeratorLine, makeInterruptController,
  speakModeratorNow, localJab, playDingSound,
} from "@/lib/debate-moderator";
```

## STEP 3 — New state (paste with the other useState lines, ~line 300)
```ts
const [category, setCategory] = useState<"Political"|"Sports"|"History"|"Finance"|"Science">("Political");
const [moderatorStyle, setModeratorStyle] = useState<ModeratorStyle>("rogan");
const [micCut, setMicCut] = useState<{iv:boolean; ivee:boolean}>({iv:false, ivee:false});
const interruptCtl = useRef(makeInterruptController()).current;
```
Your existing `duration` state is `5 | 10 | 15`. To offer 10/15/20 instead, change
its type + the setup buttons — or leave as-is; either works.

## STEP 4 — Map emotions → face mood (paste near the top, after state)
```ts
function moodFor(anger:number, frantic:number, happy:number, speaking:boolean): Mood {
  if (anger >= 55) return "angry";
  if (frantic >= 45) return speaking ? "flustered" : "shocked";
  if (!speaking && happy >= 40) return "smug";
  return "neutral";
}
```

## STEP 5 — Swap the portraits for AnimatedDebateFace
Find where the interviewer/interviewee avatars render (the two big circle images
at the top of the live view). Replace each `<Image .../>` with:

```tsx
<AnimatedDebateFace
  personaId={interviewerId!}
  baseImage={EXPRESSION_SOURCES[interviewerId!]?.neutral}
  speaking={isThinking === "interviewer" || currentSpeaker === interviewerId}
  mood={moodFor(/* your interviewer anger */ 40, 10, 30, currentSpeaker === interviewerId)}
  side="left"
  size={120}
  expressionImages={EXPRESSION_SOURCES[interviewerId!]}
/>
```
(and the mirror for `intervieweeId` with `side="right"`.)
Personas without expression images fall back to their base portrait automatically.

## STEP 6 — Moderator opening line (in your start handler, after phase→"live")
```ts
const mod = MODERATORS[moderatorStyle];
await speakModeratorNow(
  `Welcome to the ${category} debate. Two enter. One leaves with their dignity — maybe. Begin.`,
  mod.personaId
);
```

## STEP 7 — Wire the overlap interrupt into the SPEAKING sound
In your TTS playback (where you already do `sound.setOnPlaybackStatusUpdate(...)`
for a persona line), add ONE line inside that callback:
```ts
sound.setOnPlaybackStatusUpdate((status:any) => {
  interruptCtl.maybeFire(
    status, sound,
    () => setCurrentSpeaker(MODERATORS[moderatorStyle].personaId), // moderator now speaking
    () => { /* resume: your loop's normal advance */ }
  );
  // ... your existing status handling (didJustFinish etc.) stays below ...
});
```

## STEP 8 — USER CONTROLS (add buttons in the live view)
```tsx
{/* Cut mic buttons under each portrait */}
<Pressable onPress={() => { setMicCut(m=>({...m, iv:!m.iv})); playDingSound(); }}>
  <Text style={{color:"#e88"}}>{micCut.iv ? "Restore mic" : "Cut mic"}</Text>
</Pressable>

{/* Trigger the moderator */}
<Pressable onPress={async () => {
  const mod = MODERATORS[moderatorStyle];
  const line = await generateModeratorLine({
    deviceId: deviceId!, moderatorId: mod.personaId, kind: "interrupt",
    topic: topics[topicIdx]?.title, lastSpeakerText: messages[messages.length-1]?.text,
    moderatorStyle,
  });
  await interruptCtl.arm(line, mod.personaId); // fires on the 0.5s overlap of the current line
}}>
  <Text style={{color:"#22D3EE"}}>Moderator!</Text>
</Pressable>
```
Your call-in question input already exists in interview.tsx (the custom-topic /
question box) — reuse it as-is; it already routes a user question into the loop.

## STEP 9 — Respect cut-mic in the turn loop
In your `runLoop`, before a persona speaks, skip them if their mic is cut:
```ts
if ((speaker === interviewerId && micCut.iv) || (speaker === intervieweeId && micCut.ivee)) {
  // skip this turn; optionally have the moderator note it
  continue;
}
```

## STEP 10 — Category setup UI (in the "setup" phase view)
Add a row of category chips that set `category`, and pass `category` into your
topic fetch so topics match (your topic endpoint already takes context; include
the category string in the request body).

---

## What you're REUSING (do not rebuild)
- Turn engine, interruptions, prefetch pipeline, detectOffense  → already in interview.tsx
- DC tokens / entry cost                                        → useTokens()
- Crowd SFX                                                     → arena-sfx (playCrowdCheer)
- Voices + overlap                                              → audio-helper
- Poll voting / share                                          → already in interview.tsx
- Amazon links (END only)                                       → PERSONA_AMAZON_LINKS already present

## Test order
1. Duplicate → confirm /debate-stage runs exactly like interview (no changes yet)
2. Add AnimatedDebateFace → confirm portraits swap expressions
3. Add moderator opening → confirm it speaks
4. Add "Moderator!" button → confirm overlap interrupt fires with the crowd "ooh"
5. Add cut-mic → confirm it skips a turn
6. Add categories → confirm topics match the category
Do them one at a time; if a step breaks, only that step is suspect.
