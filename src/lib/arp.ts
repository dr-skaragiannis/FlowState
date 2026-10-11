export type ArpId = "up" | "down" | "wave" | "ping" | "spark" | "strum";
export type ArpSpeed = "slow" | "mid" | "fast";

export const ARP_META: { id: ArpId; label: string; hint: string; key: string }[] = [
  { id: "up", label: "Rise", hint: "Root, third, fifth, octave", key: "1" },
  { id: "down", label: "Fall", hint: "Octave, fifth, third, root", key: "4" },
  { id: "wave", label: "Drift", hint: "Root, fifth, octave, fifth", key: "8" },
  { id: "ping", label: "Hymn", hint: "Root, fifth, octave, third", key: "9" },
  { id: "spark", label: "Wander", hint: "A different tone from the chord", key: "0" },
  { id: "strum", label: "Bloom", hint: "The chord spelled slowly upward", key: "P" },
];

/** One dungeon-synth note at a time. Slow enough for the pad to bloom. */
export const ARP_SPEEDS: { id: ArpSpeed; label: string; ms: number }[] = [
  { id: "slow", label: "Slow", ms: 860 },
  { id: "mid", label: "Medium", ms: 540 },
  { id: "fast", label: "Fast", ms: 320 },
];

export const SCALE_DEGREES: Record<"major" | "minor" | "dorian" | "penta", number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  penta: [0, 2, 4, 7, 9],
};

/** Close, low voicing. Wide stacks fold down so the chord stays dark. */
export function voiceChord(midiNotes: number[]) {
  const unique = [...new Set(midiNotes.filter((n) => n >= 24 && n <= 96))].sort((a, b) => a - b);
  if (unique.length === 0) return [];
  let bass = unique[0];
  while (bass > 55) bass -= 12;
  const root = Math.max(24, bass);
  const close = unique.map((n) => {
    let v = n;
    while (v - root > 12) v -= 12;
    while (v < root) v += 12;
    return v;
  });
  return [...new Set(close)].sort((a, b) => a - b);
}

const FIGURE = 4;

/** Low dungeon figure: root, color tone, fifth, and the octave above the root. */
function dungeonNote(chord: number[], pattern: ArpId, place: number) {
  if (chord.length === 0) return null;
  const root = chord[0];
  const fifth = chord.find((n) => (n - root) % 12 === 7) ?? chord[Math.min(chord.length - 1, 1)];
  const third = chord.find((n) => n !== root && n !== fifth) ?? root;
  const high = Math.min(96, root + 12);
  if (pattern === "spark") return chord[Math.floor(Math.random() * chord.length)];
  const seq =
    pattern === "down"
      ? [high, fifth, third, root]
      : pattern === "wave"
        ? [root, fifth, high, fifth]
        : pattern === "ping"
          ? [root, fifth, high, third]
          : [root, third, fifth, high];
  return seq[place % seq.length];
}

function hymnOrder(count: number) {
  if (count <= 1) return [0];
  if (count >= 7) return [0, 6, 5, 3];
  if (count === 5) return [0, 3, 4, 1];
  return [0, Math.min(count - 1, 3), 0, Math.min(count - 1, 2)];
}

function chordIndex(pattern: ArpId, count: number, step: number, previous: number) {
  if (count <= 1) return 0;
  if (pattern === "spark") {
    let index = Math.floor(Math.random() * count);
    if (index === previous) index = (index + 1) % count;
    return index;
  }
  if (pattern === "ping") {
    const order = hymnOrder(count);
    return order[step % order.length];
  }
  if (pattern === "down") return (count - 1 - (step % count) + count) % count;
  if (pattern === "wave") {
    const cycle = count * 2 - 2;
    const pos = step % cycle;
    return pos < count ? pos : cycle - pos;
  }
  return step % count;
}

/**
 * The next single note of a slow dungeon arpeggio.
 * A held chord loops its figure. Several chords advance one shape every four notes.
 */
export function arpChordStep(pattern: ArpId, chords: number[][], step: number, previous: number) {
  const empty = { notes: [] as number[], cursor: previous, stagger: 0 };
  if (chords.length === 0) return empty;
  const index = chords.length === 1 ? 0 : chordIndex(pattern, chords.length, Math.floor(step / FIGURE), previous);
  const tone = dungeonNote(chords[index] ?? [], pattern, step % FIGURE);
  return { notes: tone == null ? [] : [tone], cursor: index, stagger: 0 };
}
