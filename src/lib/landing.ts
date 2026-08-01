/**
 * Sample content for the public landing page. None of this is real: the
 * markets, prices and headlines are invented so the page has something
 * plausible to render before a visitor signs in.
 */

export interface Outcome {
  label: string;
  pct: number;
  color: string;
}

export interface Slide {
  id: string;
  crumb: string[];
  emoji: string;
  tint: string;
  title: string;
  volume: string;
  outcomes: Outcome[];
  news: { source: string; ago: string; headline: string }[];
}

export interface Topic {
  name: string;
  today: string;
}

interface CardBase {
  id: string;
  title: string;
  emoji: string;
  tint: string;
  volume: string;
  ends: string;
}

export type Card =
  | (CardBase & {
      kind: 'gauge';
      pct: number;
      gaugeLabel: string;
      yes: string;
      no: string;
    })
  | (CardBase & {
      kind: 'updown';
      pct: number;
      gaugeLabel: string;
      upLabel: string;
      downLabel: string;
      rungs: { up: string; down: string }[];
    })
  | (CardBase & { kind: 'rows'; rows: { label: string; pct: number }[] })
  | (CardBase & {
      kind: 'versus';
      sides: { name: string; emoji: string; tint: string; score: number; pct: number }[];
    });

/* ── chart series ──────────────────────────────────────────────────────────
   A seeded walk so the server and the client render the same squiggle. */

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

/** A random walk that drifts from `start` to `end`, with the odd jump. */
export function walk(seed: string, start: number, end: number, n = 96): number[] {
  const next = rng(seed);
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const target = start + (end - start) * t;
    const jolt = next() > 0.95 ? (next() - 0.5) * 0.16 : 0;
    v += (target - v) * 0.22 + (next() - 0.5) * 0.035 + jolt;
    out.push(Math.min(0.97, Math.max(0.01, v)));
  }
  out[n - 1] = end;
  return out;
}

/** `series` mapped into an SVG polyline over a 0–1 vertical domain. */
export function points(series: number[], w: number, h: number, padY = 6): string {
  const span = h - padY * 2;
  return series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = padY + (1 - v) * span;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/* ── content ───────────────────────────────────────────────────────────── */

export const SLIDES: Slide[] = [
  {
    id: 'mrt',
    crumb: ['Second Period', 'Grades'],
    emoji: '📐',
    tint: 'linear-gradient(140deg,#2b3f66,#16233d)',
    title: "What does Jonathan get on Mr. T's calc test?",
    volume: '$3,240 Vol',
    outcomes: [
      { label: 'B (80-89)', pct: 41, color: '#4f8ef7' },
      { label: 'C (70-79)', pct: 29, color: '#7ab6ff' },
      { label: 'A (90+)', pct: 18, color: '#e8b93d' },
      { label: 'Under 70', pct: 12, color: '#e8823d' },
    ],
    news: [
      {
        source: 'Priya',
        ago: '2h ago',
        headline: 'Mr. T said out loud that he is curving it five points, I was sitting right there',
      },
      {
        source: 'Jonathan',
        ago: '4h ago',
        headline: 'i did the entire review packet twice, stop shorting me',
      },
    ],
  },
  {
    id: 'dishes',
    crumb: ['The Apartment', 'Chores'],
    emoji: '🍽️',
    tint: 'linear-gradient(140deg,#1f4f4a,#122b2a)',
    title: 'Who actually does the dishes on Friday?',
    volume: '$1,880 Vol',
    outcomes: [
      { label: 'Marcus', pct: 44, color: '#4f8ef7' },
      { label: 'Nobody', pct: 27, color: '#7ab6ff' },
      { label: 'Dev', pct: 19, color: '#e8b93d' },
      { label: 'Sam', pct: 10, color: '#e8823d' },
    ],
    news: [
      {
        source: 'Marcus',
        ago: '35m ago',
        headline: 'I did them twice last week. Twice. Check the group chat.',
      },
      {
        source: 'Dev',
        ago: '1d ago',
        headline: 'Buying Nobody at 27, this house has no shame and history backs me up',
      },
    ],
  },
  {
    id: 'trip',
    crumb: ['Ski Trip', 'Logistics'],
    emoji: '🚗',
    tint: 'linear-gradient(140deg,#4b3a72,#241c3d)',
    title: 'What time do we actually leave Saturday?',
    volume: '$2,415 Vol',
    outcomes: [
      { label: '11am - 1pm', pct: 38, color: '#4f8ef7' },
      { label: '9am - 11am', pct: 34, color: '#7ab6ff' },
      { label: 'After 1pm', pct: 19, color: '#e8b93d' },
      { label: 'Before 9am', pct: 9, color: '#e8823d' },
    ],
    news: [
      {
        source: 'Sam',
        ago: '6h ago',
        headline: 'Call time is 8:30am and I mean it this year, the lifts close at four',
      },
      {
        source: 'Priya',
        ago: '2d ago',
        headline: 'Dev has never left the house before 11 in his life. Free money.',
      },
    ],
  },
];

export const TOPICS: Topic[] = [
  { name: "Mr. T's test", today: '$740 today' },
  { name: 'Friday dishes', today: '$512 today' },
  { name: 'Ski trip', today: '$430 today' },
  { name: 'Gym streak', today: '$188 today' },
  { name: 'Fantasy league', today: '$96 today' },
];

export const FILTERS = [
  'All',
  "Mr. T's test",
  'Chores',
  'Ski trip',
  'Gym streak',
  'Fantasy',
  'Ping pong',
  'Exams',
  'Group chat',
  'Lunch',
  'Thesis',
  'Roommates',
];

export const CARDS: Card[] = [
  {
    kind: 'gauge',
    id: 'pass',
    title: "Does Jonathan pass Mr. T's test?",
    emoji: '📐',
    tint: 'linear-gradient(140deg,#2b3f66,#16233d)',
    volume: '$3,240 Vol',
    ends: 'Ends Friday 3pm',
    pct: 64,
    gaugeLabel: 'Yes',
    yes: 'Yes 64¢',
    no: 'No 36¢',
  },
  {
    kind: 'updown',
    id: 'wordle',
    title: "Marcus's Wordle: over/under 4",
    emoji: '🟩',
    tint: 'linear-gradient(140deg,#3d5a34,#1c2a18)',
    volume: '$460 Vol',
    ends: 'Ends in 4m 12s',
    pct: 57,
    gaugeLabel: 'Over',
    upLabel: 'Over',
    downLabel: 'Under',
    rungs: [
      { up: '+$5', down: '+$1' },
      { up: '+$7', down: '+$4' },
      { up: '+$1', down: '+$4' },
    ],
  },
  {
    kind: 'rows',
    id: 'grade',
    title: "What does Jonathan get on Mr. T's calc test?",
    emoji: '📐',
    tint: 'linear-gradient(140deg,#2b3f66,#16233d)',
    volume: '$3,240 Vol',
    ends: 'Ends Friday 3pm',
    rows: [
      { label: 'B (80-89)', pct: 41 },
      { label: 'C (70-79)', pct: 29 },
      { label: 'A (90+)', pct: 18 },
    ],
  },
  {
    kind: 'versus',
    id: 'pingpong',
    title: 'Ping pong final — tonight',
    emoji: '🏓',
    tint: 'linear-gradient(140deg,#5c2a4a,#2c1424)',
    volume: '$820 Vol',
    ends: 'Game 3',
    sides: [
      { name: 'Marcus', emoji: 'M', tint: '#2f4a7a', score: 2, pct: 61 },
      { name: 'Priya', emoji: 'P', tint: '#5c3b22', score: 1, pct: 39 },
    ],
  },
  {
    kind: 'rows',
    id: 'dishes-card',
    title: 'Who does the dishes on Friday?',
    emoji: '🍽️',
    tint: 'linear-gradient(140deg,#1f4f4a,#122b2a)',
    volume: '$1,880 Vol',
    ends: 'Ends Sat 12am',
    rows: [
      { label: 'Marcus', pct: 44 },
      { label: 'Nobody', pct: 27 },
      { label: 'Dev', pct: 19 },
    ],
  },
  {
    kind: 'gauge',
    id: 'gym',
    title: 'Dev\'s gym streak hits 30 days?',
    emoji: '🏋️',
    tint: 'linear-gradient(140deg,#4a4438,#22201a)',
    volume: '$1,105 Vol',
    ends: 'Ends Nov 2',
    pct: 38,
    gaugeLabel: 'Yes',
    yes: 'Yes 38¢',
    no: 'No 62¢',
  },
  {
    kind: 'rows',
    id: 'trip-card',
    title: 'What time do we leave Saturday?',
    emoji: '🚗',
    tint: 'linear-gradient(140deg,#4b3a72,#241c3d)',
    volume: '$2,415 Vol',
    ends: 'Ends Sat 8am',
    rows: [
      { label: '11am - 1pm', pct: 38 },
      { label: '9am - 11am', pct: 34 },
      { label: 'After 1pm', pct: 19 },
    ],
  },
  {
    kind: 'gauge',
    id: 'thesis',
    title: 'Thesis draft sent by Sunday?',
    emoji: '📄',
    tint: 'linear-gradient(140deg,#3a4d63,#1b242f)',
    volume: '$690 Vol',
    ends: 'Ends Sun 11:59pm',
    pct: 71,
    gaugeLabel: 'Yes',
    yes: 'Yes 71¢',
    no: 'No 29¢',
  },
  {
    kind: 'versus',
    id: 'fifa',
    title: 'FIFA rematch — Dev vs. Sam',
    emoji: '🎮',
    tint: 'linear-gradient(140deg,#2f3a6b,#171d38)',
    volume: '$540 Vol',
    ends: '78th minute',
    sides: [
      { name: 'Dev', emoji: 'D', tint: '#4a4a4a', score: 2, pct: 55 },
      { name: 'Sam', emoji: 'S', tint: '#5c3b22', score: 2, pct: 45 },
    ],
  },
  {
    kind: 'rows',
    id: 'lunch',
    title: 'Where does the group eat on Friday?',
    emoji: '🌮',
    tint: 'linear-gradient(140deg,#5c4a12,#2b2209)',
    volume: '$312 Vol',
    ends: 'Ends Fri 6pm',
    rows: [
      { label: 'The usual taco place', pct: 46 },
      { label: 'Somewhere new', pct: 33 },
      { label: 'Nobody goes out', pct: 21 },
    ],
  },
  {
    kind: 'gauge',
    id: 'snow',
    title: 'Snow on the hill before the trip?',
    emoji: '🌨️',
    tint: 'linear-gradient(140deg,#3a4d63,#1b242f)',
    volume: '$980 Vol',
    ends: 'Ends Nov 15',
    pct: 68,
    gaugeLabel: 'Yes',
    yes: 'Yes 68¢',
    no: 'No 32¢',
  },
  {
    kind: 'rows',
    id: 'fantasy',
    title: 'Who wins the house fantasy league?',
    emoji: '🏆',
    tint: 'linear-gradient(140deg,#5c2f22,#2b1610)',
    volume: '$1,640 Vol',
    ends: 'Ends Dec 28',
    rows: [
      { label: 'Sam', pct: 36 },
      { label: 'Priya', pct: 31 },
      { label: 'Marcus', pct: 22 },
    ],
  },
];
