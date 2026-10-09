// The decision schema Clef-omni scores in a single forward pass.
// Every answer comes back as calibrated probabilities -- no text generation.

export const QUESTIONS = {
  pet_present: {
    type: "noul",
    instructions: "Is a pet animal (dog, cat, bird, rabbit, etc.) seen or heard in the media?",
  },
  species: {
    type: "choice",
    instructions: "What kind of animal is the main pet?",
    criteria: {
      dog: "A dog or puppy",
      cat: "A cat or kitten",
      bird: "A parrot, budgie, chicken, or other bird",
      small_mammal: "A rabbit, hamster, guinea pig, ferret, or similar small mammal",
      other: "Some other animal (reptile, horse, goat, fish, etc.)",
      none: "No animal is present",
    },
  },
  need: {
    type: "choice",
    instructions:
      "Using the pet's sounds, body language, and surroundings together, what is the pet most likely trying to communicate?",
    criteria: {
      hungry: "Wants food or treats: begging, staring at food, a bowl, the kitchen, or the fridge",
      outside: "Wants to go outside or for a walk: waiting at a door, near a leash, pacing by an exit",
      play: "Wants to play: play bow, bringing or chasing a toy, zoomies, pouncing, excited bouncing",
      attention: "Wants attention or affection from the human: pawing, nudging, whining at, or staring at the person",
      alert: "Alerting to something: barking or staring at a window, door, noise, or stranger",
      annoyed: "Annoyed or wants to be left alone: hissing, growling, flattened ears, tail flicking, walking away",
      anxious: "Nervous or scared: cowering, trembling, tucked tail, hiding, wide eyes",
      sleepy: "Tired or relaxed: lying down, yawning, eyes closing, stretching",
      content: "Happy and content: purring, relaxed wagging, calm, cuddling, rolling over",
      chaos: "Being dramatic or chaotic for no clear reason",
    },
  },
  vocalization: {
    type: "choice",
    instructions: "What is the pet's main vocalization in the audio?",
    criteria: {
      bark: "Barking or yapping",
      howl: "Howling or 'singing'",
      whine: "Whining, whimpering, or crying",
      growl: "Growling",
      meow: "Meowing or yowling",
      purr: "Purring",
      hiss: "Hissing or spitting",
      chirp: "Chirping, trilling, chattering, or squeaking",
      squawk: "Squawking, clucking, or a bird talking",
      silent: "No pet sound can be heard",
    },
  },
  intensity: {
    type: "score",
    instructions: "How intense or insistent is the pet's communication?",
    criteria: ["Completely chill", "Mildly interested", "Insistent", "Very urgent", "Full meltdown"],
  },
  drama: {
    type: "score",
    instructions: "How dramatic or theatrical is the pet being relative to the situation?",
    criteria: ["Stoic", "Reasonable", "A bit extra", "Very dramatic", "Oscar-worthy performance"],
  },
  staring_at_camera: {
    type: "noul",
    instructions: "Is the pet looking directly at the camera or the person filming?",
  },
  food_visible: {
    type: "noul",
    instructions: "Is food, a food bowl, treats, or a kitchen visible?",
  },
  door_or_leash_visible: {
    type: "noul",
    instructions: "Is a door, a leash, or a window visible near the pet?",
  },
  toy_visible: {
    type: "noul",
    instructions: "Is a pet toy, ball, or string visible?",
  },
  human_talking: {
    type: "noul",
    instructions: "Can a human be heard speaking in the audio?",
  },
} as const;

export function buildState(opts: {
  name: string;
  context: string;
  localTime: string;
  media: string[];
}): string {
  return [
    "Pet translator request. An owner captured their pet and wants to know what the pet is trying to communicate.",
    `Pet name: ${opts.name || "unknown"}.`,
    `Owner's local time: ${opts.localTime || "unknown"}.`,
    `Owner's note: ${opts.context || "none"}.`,
    `Attached media: ${opts.media.join(", ")}.`,
    "Judge from the animal's sounds, body language, and surroundings together.",
  ].join("\n");
}
