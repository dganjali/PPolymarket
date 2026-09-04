/**
 * Sample content for the public landing page. None of this is real: the
 * markets, prices and headlines are invented so the page has something
 * plausible to render before a visitor signs in.
 */

/** A drawn mark for a market — see components/landing/Glyphs.tsx. */
export type GlyphName =
  | 'grades'
  | 'dishes'
  | 'car'
  | 'grid'
  | 'paddle'
  | 'dumbbell'
  | 'document'
  | 'controller'
  | 'bowl'
  | 'snow'
  | 'trophy'
  | 'thermostat'
  | 'coins'
  | 'chat'
  | 'target';

export interface Outcome {
  label: string;
  pct: number;
  color: string;
}

export interface Slide {
  id: string;
  /** The card in the grid this slide is the long form of. Shares its bookmark. */
  cardId: string;
  crumb: string[];
  glyph: GlyphName;
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
  glyph: GlyphName;
  tint: string;
  /** Which filter chip it answers to. */
  topic: string;
  /** Which category in the header rail it sits under. */
  category: string;
  /** Play money through it, as a number for sorting and a label for reading. */
  vol: number;
  volume: string;
  /** Hours until it closes and hours since it opened, for sorting. */
  closesIn: number;
  age: number;
  ends: string;
  /** Seconds left, for a card whose deadline is close enough to count down live. */
  endsIn?: number;
  /** Something is happening right now: a game in progress, a clock running. */
  live?: boolean;
}

export type Card =
  | (CardBase & {
      kind: 'gauge';
      pct: number;
      gaugeLabel: string;
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
      sides: { name: string; initial: string; tint: string; score: number; pct: number }[];
    });

/** One trade on the ticker tape under the header. */
export interface Fill {
  who: string;
  side: 'yes' | 'no';
  /** The outcome bought — "Yes", or a named option. */
  label: string;
  /** In cents. */
  price: number;
  market: string;
}

export interface Step {
  icon: 'invite' | 'ask' | 'trade';
  title: string;
  body: string;
}

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

const TINT = {
  grades: 'linear-gradient(140deg,#2b3f66,#16233d)',
  chores: 'linear-gradient(140deg,#1f4f4a,#122b2a)',
  trip: 'linear-gradient(140deg,#4b3a72,#241c3d)',
  wordle: 'linear-gradient(140deg,#3d5a34,#1c2a18)',
  pingpong: 'linear-gradient(140deg,#5c2a4a,#2c1424)',
  gym: 'linear-gradient(140deg,#4a4438,#22201a)',
  thesis: 'linear-gradient(140deg,#3a4d63,#1b242f)',
  fifa: 'linear-gradient(140deg,#2f3a6b,#171d38)',
  lunch: 'linear-gradient(140deg,#5c4a12,#2b2209)',
  fantasy: 'linear-gradient(140deg,#5c2f22,#2b1610)',
  roommates: 'linear-gradient(140deg,#5a3a1e,#2a1b0e)',
  money: 'linear-gradient(140deg,#1e4d3a,#0f2a1f)',
  chat: 'linear-gradient(140deg,#3f2e6b,#1e1636)',
  longshot: 'linear-gradient(140deg,#5a2434,#2c1019)',
};

export const SLIDES: Slide[] = [
  {
    id: 'mrt',
    cardId: 'grade',
    crumb: ['Second Period', 'Grades'],
    glyph: 'grades',
    tint: TINT.grades,
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
    cardId: 'dishes-card',
    crumb: ['The Apartment', 'Chores'],
    glyph: 'dishes',
    tint: TINT.chores,
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
    cardId: 'trip-card',
    crumb: ['Ski Trip', 'Logistics'],
    glyph: 'car',
    tint: TINT.trip,
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

/** The filter chips over the grid. Every card's `topic` is one of these. */
export const FILTERS = [
  'All',
  "Mr. T's test",
  'Chores',
  'Ski trip',
  'Gym streak',
  'Fantasy',
  'Ping pong',
  'Game night',
  'Group chat',
  'Lunch',
  'Thesis',
  'Roommates',
  'Money',
];

/** The category rail in the header. Every card's `category` is one of these. */
export const CATEGORIES = [
  'School',
  'Roommates',
  'Sports',
  'Gaming',
  'Chores',
  'Trips',
  'Fantasy',
  'Group chat',
  'Grades',
  'Weather',
  'Money',
  'Gym',
  'Food',
  'Long shots',
];

export const CARDS: Card[] = [
  {
    kind: 'gauge',
    id: 'pass',
    title: "Does Jonathan pass Mr. T's test?",
    glyph: 'grades',
    tint: TINT.grades,
    topic: "Mr. T's test",
    category: 'Grades',
    vol: 3240,
    volume: '$3,240 Vol',
    closesIn: 60,
    age: 96,
    ends: 'Ends Friday 3pm',
    pct: 64,
    gaugeLabel: 'Yes',
  },
  {
    kind: 'updown',
    id: 'wordle',
    title: "Marcus's Wordle: over/under 4",
    glyph: 'grid',
    tint: TINT.wordle,
    topic: 'Group chat',
    category: 'Gaming',
    vol: 460,
    volume: '$460 Vol',
    closesIn: 0.07,
    age: 1,
    ends: 'Ends in 4m 12s',
    endsIn: 4 * 60 + 12,
    live: true,
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
    glyph: 'grades',
    tint: TINT.grades,
    topic: "Mr. T's test",
    category: 'Grades',
    vol: 3240,
    volume: '$3,240 Vol',
    closesIn: 60,
    age: 96,
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
    glyph: 'paddle',
    tint: TINT.pingpong,
    topic: 'Ping pong',
    category: 'Sports',
    vol: 820,
    volume: '$820 Vol',
    closesIn: 1,
    age: 30,
    ends: 'Game 3',
    live: true,
    sides: [
      { name: 'Marcus', initial: 'M', tint: '#2f4a7a', score: 2, pct: 61 },
      { name: 'Priya', initial: 'P', tint: '#5c3b22', score: 1, pct: 39 },
    ],
  },
  {
    kind: 'rows',
    id: 'dishes-card',
    title: 'Who does the dishes on Friday?',
    glyph: 'dishes',
    tint: TINT.chores,
    topic: 'Chores',
    category: 'Chores',
    vol: 1880,
    volume: '$1,880 Vol',
    closesIn: 69,
    age: 200,
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
    title: "Dev's gym streak hits 30 days?",
    glyph: 'dumbbell',
    tint: TINT.gym,
    topic: 'Gym streak',
    category: 'Gym',
    vol: 1105,
    volume: '$1,105 Vol',
    closesIn: 900,
    age: 400,
    ends: 'Ends Nov 2',
    pct: 38,
    gaugeLabel: 'Yes',
  },
  {
    kind: 'rows',
    id: 'trip-card',
    title: 'What time do we leave Saturday?',
    glyph: 'car',
    tint: TINT.trip,
    topic: 'Ski trip',
    category: 'Trips',
    vol: 2415,
    volume: '$2,415 Vol',
    closesIn: 77,
    age: 150,
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
    glyph: 'document',
    tint: TINT.thesis,
    topic: 'Thesis',
    category: 'School',
    vol: 690,
    volume: '$690 Vol',
    closesIn: 110,
    age: 48,
    ends: 'Ends Sun 11:59pm',
    pct: 71,
    gaugeLabel: 'Yes',
  },
  {
    kind: 'versus',
    id: 'fifa',
    title: 'FIFA rematch — Dev vs. Sam',
    glyph: 'controller',
    tint: TINT.fifa,
    topic: 'Game night',
    category: 'Gaming',
    vol: 540,
    volume: '$540 Vol',
    closesIn: 0.3,
    age: 2,
    ends: '78th minute',
    live: true,
    sides: [
      { name: 'Dev', initial: 'D', tint: '#4a4a4a', score: 2, pct: 55 },
      { name: 'Sam', initial: 'S', tint: '#5c3b22', score: 2, pct: 45 },
    ],
  },
  {
    kind: 'rows',
    id: 'lunch',
    title: 'Where does the group eat on Friday?',
    glyph: 'bowl',
    tint: TINT.lunch,
    topic: 'Lunch',
    category: 'Food',
    vol: 312,
    volume: '$312 Vol',
    closesIn: 63,
    age: 20,
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
    glyph: 'snow',
    tint: TINT.thesis,
    topic: 'Ski trip',
    category: 'Weather',
    vol: 980,
    volume: '$980 Vol',
    closesIn: 1200,
    age: 300,
    ends: 'Ends Nov 15',
    pct: 68,
    gaugeLabel: 'Yes',
  },
  {
    kind: 'rows',
    id: 'fantasy',
    title: 'Who wins the house fantasy league?',
    glyph: 'trophy',
    tint: TINT.fantasy,
    topic: 'Fantasy',
    category: 'Fantasy',
    vol: 1640,
    volume: '$1,640 Vol',
    closesIn: 2200,
    age: 800,
    ends: 'Ends Dec 28',
    rows: [
      { label: 'Sam', pct: 36 },
      { label: 'Priya', pct: 31 },
      { label: 'Marcus', pct: 22 },
    ],
  },
  {
    kind: 'gauge',
    id: 'thermostat',
    title: 'Does the thermostat war end before December?',
    glyph: 'thermostat',
    tint: TINT.roommates,
    topic: 'Roommates',
    category: 'Roommates',
    vol: 275,
    volume: '$275 Vol',
    closesIn: 1800,
    age: 12,
    ends: 'Ends Dec 1',
    pct: 22,
    gaugeLabel: 'Yes',
  },
  {
    kind: 'gauge',
    id: 'payback',
    title: 'Sam pays back the $40 by Friday?',
    glyph: 'coins',
    tint: TINT.money,
    topic: 'Money',
    category: 'Money',
    vol: 615,
    volume: '$615 Vol',
    closesIn: 62,
    age: 6,
    ends: 'Ends Friday 5pm',
    pct: 31,
    gaugeLabel: 'Yes',
  },
  {
    kind: 'rows',
    id: 'leaves',
    title: 'Who leaves the group chat first?',
    glyph: 'chat',
    tint: TINT.chat,
    topic: 'Group chat',
    category: 'Group chat',
    vol: 430,
    volume: '$430 Vol',
    closesIn: 2300,
    age: 72,
    ends: 'Ends Dec 31',
    rows: [
      { label: 'Dev', pct: 38 },
      { label: 'Nobody', pct: 33 },
      { label: 'Sam', pct: 29 },
    ],
  },
  {
    kind: 'gauge',
    id: 'perfect',
    title: 'Jonathan gets a perfect score on the calc test',
    glyph: 'target',
    tint: TINT.longshot,
    topic: "Mr. T's test",
    category: 'Long shots',
    vol: 190,
    volume: '$190 Vol',
    closesIn: 60,
    age: 40,
    ends: 'Ends Friday 3pm',
    pct: 4,
    gaugeLabel: 'Yes',
  },
];

/* ── the tape ──────────────────────────────────────────────────────────────
   Recent fills, scrolling under the header. Invented, like everything else
   here, but shaped like the real event feed so the page reads as a live
   market rather than a brochure. */

export const TAPE: Fill[] = [
  { who: 'Priya', side: 'yes', label: 'B (80-89)', price: 41, market: "Mr. T's test" },
  { who: 'Marcus', side: 'no', label: 'Nobody', price: 73, market: 'Friday dishes' },
  { who: 'Dev', side: 'yes', label: 'Over', price: 57, market: "Marcus's Wordle" },
  { who: 'Sam', side: 'yes', label: '11am - 1pm', price: 38, market: 'Saturday departure' },
  { who: 'Elena', side: 'no', label: 'Yes', price: 62, market: 'Gym streak' },
  { who: 'Kai', side: 'yes', label: 'Marcus', price: 61, market: 'Ping pong final' },
  { who: 'Tess', side: 'yes', label: 'Yes', price: 71, market: 'Thesis by Sunday' },
  { who: 'Loic', side: 'no', label: 'Sam', price: 64, market: 'Fantasy league' },
  { who: 'Nadia', side: 'yes', label: 'The usual taco place', price: 46, market: 'Friday lunch' },
  { who: 'Owen', side: 'yes', label: 'Yes', price: 68, market: 'Snow before the trip' },
  { who: 'Sofia', side: 'no', label: 'Dev', price: 45, market: 'FIFA rematch' },
  { who: 'Jonathan', side: 'yes', label: 'A (90+)', price: 18, market: "Mr. T's test" },
];

/* ── how it works ──────────────────────────────────────────────────────── */

export const HOW: Step[] = [
  {
    icon: 'invite',
    title: 'Start a group',
    body: 'One invite link. Everyone who joins gets the same play-money bankroll, so nobody buys their way to the top.',
  },
  {
    icon: 'ask',
    title: 'Ask a question',
    body: 'Anything with a clear answer by a clear date. Does Dev leave before 11? Who does the dishes? Thirty seconds to post.',
  },
  {
    icon: 'trade',
    title: 'Let the odds argue',
    body: 'Shares priced by an automated market maker. Being right pays $1 a share. Being loud pays nothing.',
  },
];

/* ── the sandbox market ────────────────────────────────────────────────────
   One market a visitor can trade against, in the browser, on the same
   market maker the app runs. */

export const TRY = {
  crumb: ['Ski Trip', 'Logistics'],
  glyph: 'car' as GlyphName,
  tint: TINT.trip,
  question: 'Does Dev leave the house before 11am on Saturday?',
  /** Where the odds stand when the visitor arrives. */
  probability: 0.34,
  /** Collateral the pool opens with. Bigger pools move less per dollar. */
  funding: 500,
  /** The pretend bankroll a visitor gets to play with. */
  bankroll: 2500,
};
