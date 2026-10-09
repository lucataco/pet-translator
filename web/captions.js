// Clef-omni doesn't generate text -- it makes calibrated decisions.
// We turn those decisions into a subtitle by picking from hand-written lines.

export const NEED_LABELS = {
  hungry: "Hungry",
  outside: "Wants out",
  play: "Wants to play",
  attention: "Wants attention",
  alert: "On high alert",
  annoyed: "Annoyed",
  anxious: "Nervous",
  sleepy: "Sleepy",
  content: "Content",
  chaos: "Pure chaos",
};

export const SPECIES_LABELS = {
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  small_mammal: "Small floof",
  other: "Mystery creature",
  none: "No pet",
};

export const VOCAL_LABELS = {
  bark: "Barking",
  howl: "Howling",
  whine: "Whining",
  growl: "Growling",
  meow: "Meowing",
  purr: "Purring",
  hiss: "Hissing",
  chirp: "Chirping",
  squawk: "Squawking",
  silent: "Silent",
};

const LINES = {
  hungry: {
    dog: [
      "I have not eaten in what feels like 400 years. It has been 40 minutes.",
      "Requesting one (1) snack. Or seven. I'm flexible.",
      "I heard the fridge open. I know what you're hiding.",
      "Good dogs get paid in treats. I am a very good dog. Pay me.",
    ],
    cat: [
      "The bowl. Look at the bowl. I can see the BOTTOM of the bowl.",
      "Feed me and I'll consider not screaming at 4am.",
      "You call that breakfast? I've filed a formal complaint.",
      "I will knock this off the counter in 3... 2...",
    ],
    bird: ["Seed. Seed. Seed. I'm saying it in your language now.", "Snack tax. Pay it."],
    any: ["Food. Now. Please. Mostly now.", "I am small and the snacks are far away."],
  },
  outside: {
    dog: [
      "The door. THE DOOR. Do you not see the door?",
      "A squirrel out there said something about my mother. Let me out.",
      "Walk? Did someone say walk? I said walk. Let's walk.",
      "I need to go outside and re-smell every single thing.",
    ],
    cat: [
      "Let me out. Then let me in. Then out. This is my right.",
      "There's a bird outside and I need to have words with it.",
    ],
    any: ["Outside is calling, and I must answer.", "I require fresh air and fresh drama."],
  },
  play: {
    dog: [
      "THROW IT. THROW THE THING. I'LL BRING IT BACK. PROBABLY.",
      "Play bow engaged. You have three seconds to comply.",
      "Zoomies imminent. Secure the furniture.",
      "This toy is the love of my life. Please throw it far away from me.",
    ],
    cat: [
      "I'm going to attack your ankles and you're going to like it.",
      "Wiggle the string. No, not like that. Like you MEAN it.",
      "I have chosen violence. The fun kind.",
    ],
    any: ["Play with me. This is not a request.", "I have so much energy and nowhere to put it."],
  },
  attention: {
    dog: [
      "Hi. Hi. Hello. Hi. I love you. Hi.",
      "You've been staring at that rectangle for too long. Stare at me instead.",
      "Pet me. No, keep going. Why did you stop?",
    ],
    cat: [
      "You may pet me exactly twice. The third time is a felony.",
      "I sat on your keyboard because I'm more important than your job.",
      "Acknowledge me, servant.",
    ],
    bird: ["Look at me. Look at me. Okay now look at me again."],
    any: ["I would like 100% of your attention, please.", "Notice me. Then keep noticing me."],
  },
  alert: {
    dog: [
      "INTRUDER. It's the mail carrier. It is ALWAYS the mail carrier.",
      "Something moved. Maybe a leaf. Maybe a threat. Both deserve barking.",
      "I am protecting this house from a plastic bag. You're welcome.",
    ],
    cat: [
      "Something is there. Nobody else can see it. I can see it.",
      "I'm staring at the wall because the wall knows what it did.",
    ],
    any: ["Did you hear that? I heard that. I'll keep you posted.", "Stay back. I'll handle this."],
  },
  annoyed: {
    dog: [
      "I'm being patient, but my patience has a timer.",
      "No. I do not want the sweater. Take it off.",
    ],
    cat: [
      "Touch me again and see what happens.",
      "I tolerate you. Do not confuse that with liking you.",
      "Put the camera down. I have lawyers.",
    ],
    any: ["Please leave me alone. Respectfully. And also not respectfully.", "I've had it up to here. And I'm short."],
  },
  anxious: {
    dog: [
      "Was that thunder? I'd like to sit very close to you now.",
      "I don't love this. Can you hold me for a bit?",
    ],
    cat: [
      "I'm going under the bed for the next three to five business days.",
      "I'm not scared. I'm strategically hiding.",
    ],
    any: ["This is a lot. Can we go somewhere quieter?", "Stay close, okay? Just for a minute."],
  },
  sleepy: {
    dog: [
      "Shhh. This is my 14th nap of the day. It's important work.",
      "Five more minutes. Or five more hours.",
    ],
    cat: [
      "Do not disturb. I'm recharging for tonight's 3am zoomies.",
      "I've been awake for eleven minutes. I'm exhausted.",
    ],
    any: ["Nap time. Dim the lights. Lower your voice.", "I am horizontal and I intend to stay that way."],
  },
  content: {
    dog: [
      "Life is good. You are good. This floor is good.",
      "I'm the happiest I've ever been. Again. Like yesterday.",
    ],
    cat: [
      "This is acceptable. You may continue existing near me.",
      "I'm purring. Don't read into it.",
    ],
    any: ["Everything is fine. Better than fine. Love you.", "No notes. Ten out of ten. Would exist again."],
  },
  chaos: {
    dog: [
      "I don't know why I'm doing this. I just know I must.",
      "Was that me? That was me. I regret nothing.",
    ],
    cat: [
      "I knocked it over because it was there. That's my whole philosophy.",
      "Chaos is a ladder and I have climbed it.",
    ],
    any: ["No thoughts. Only chaos.", "I contain multitudes and all of them are loud."],
  },
};

const NO_PET = [
  "No pet detected. If this is you, please consult a different translator.",
  "I'm a pet translator, not a miracle worker. Where's the pet?",
  "Zero animals found. Unless you count the human. We don't.",
];

const DEFAULT_SPEAKER = {
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  small_mammal: "Floof",
  other: "Creature",
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length) % arr.length];
const p = (a, id) => a?.[id]?.noul ?? 0;

// Extra beats driven by the other decisions -- this is where the
// cross-modal evidence (what's in frame, what's in the audio) shows up.
function garnishes(a, need) {
  const out = [];
  if (need === "hungry" && p(a, "food_visible") > 0.6) out.push("Yes, I can see the bowl. So can you.");
  if (need === "outside" && p(a, "door_or_leash_visible") > 0.6) out.push("The leash is RIGHT THERE.");
  if (need === "play" && p(a, "toy_visible") > 0.6) out.push("The toy is right there. Take the hint.");
  if (p(a, "staring_at_camera") > 0.7) out.push("I'm making eye contact so you know I'm serious.");
  if (p(a, "human_talking") > 0.7) out.push("Also, please stop narrating. I'm talking.");
  if ((a?.drama?.score ?? 0) >= 2.8) out.push("This is my villain origin story.");
  return out;
}

export function buildCaption(answers, { name = "", seed = 1 } = {}) {
  const rand = mulberry32(seed * 2654435761);
  const species = answers?.species?.choice ?? "other";
  const present = answers?.pet_present?.noul ?? 1;

  if (present < 0.3 || species === "none") {
    return { speaker: "Translator", text: pick(NO_PET, rand), need: null, shout: false };
  }

  const need = answers?.need?.choice ?? "chaos";
  const bucket = LINES[need] ?? LINES.chaos;
  const pool = [...(bucket[species] ?? []), ...(bucket[species] ? [] : bucket.any), ...bucket.any.slice(0, 1)];
  let text = pick(pool, rand);

  const extras = garnishes(answers, need);
  if (extras.length && rand() < 0.75) text += " " + pick(extras, rand);

  const shout = (answers?.intensity?.score ?? 0) >= 3.2;
  if (shout) text = text.toUpperCase();

  const speaker = (name || "").trim() || DEFAULT_SPEAKER[species] || "Pet";
  return { speaker, text, need, shout };
}
