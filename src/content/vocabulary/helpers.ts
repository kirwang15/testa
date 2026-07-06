import type { CEFRLevel, VocabularyImportWord } from "@/types/game";

type CreateMockWordInput = {
  unitId: string;
  word: string;
  englishMeaning?: string;
  chineseMeaning: string;
  displayText?: string;
  phonetic?: string;
  partOfSpeech?: string;
  difficulty?: number;
  cefrLevel?: CEFRLevel;
  frequencyRank?: number;
  examples?: string[];
  tags?: string[];
  learningConcept?: string;
};

const defaultEnglishMeanings: Record<string, string> = {
  actor: "a person who performs in plays or films",
  air: "the invisible gas around us",
  ant: "a very small insect that lives in groups",
  apple: "a round fruit with sweet or crisp flesh",
  arm: "the body part from the shoulder to the hand",
  bag: "a soft container used to carry things",
  bat: "a flying mammal active at night",
  beach: "the sandy or pebbly edge of the sea",
  bell: "a metal object that rings",
  book: "a set of written or printed pages",
  bowl: "a round deep dish for food",
  bread: "a baked food made from flour",
  bus: "a large road vehicle for many passengers",
  car: "a road vehicle for a few people",
  cat: "a small animal often kept as a pet",
  cup: "a small container used for drinking",
  dog: "a common animal often kept as a pet",
  dream: "a series of thoughts or images during sleep",
  ear: "the body part used for hearing",
  easy: "not hard to do",
  egg: "an oval object laid by a bird",
  fan: "a device that moves air",
  fish: "an animal that lives in water",
  flower: "the colorful part of a plant",
  forest: "a large area covered with trees",
  future: "the time that comes after now",
  garden: "an area where plants are grown",
  gem: "a valuable polished stone",
  hand: "the body part at the end of the arm",
  hat: "something worn on the head",
  hen: "an adult female chicken",
  ink: "colored liquid used for writing or printing",
  king: "a male ruler of a country",
  lesson: "a period of teaching and learning",
  log: "a thick piece of cut wood",
  man: "an adult male person",
  map: "a drawing that shows places and directions",
  memory: "the ability to remember",
  nest: "a home built by birds or insects",
  net: "an open material used for catching or holding things",
  north: "the direction opposite south",
  novel: "a long written story",
  oak: "a strong tree that produces acorns",
  oil: "a thick liquid used in cooking or machines",
  okay: "all right or acceptable",
  oven: "a heated box used for cooking or baking",
  pan: "a metal container used for cooking",
  pen: "a tool used for writing with ink",
  pencil: "a writing tool with graphite inside",
  plate: "a flat dish for serving food",
  rat: "a medium-sized rodent",
  red: "the color of fire or ripe strawberries",
  river: "a large natural stream of water",
  rug: "a small floor covering",
  salad: "a cold dish of mixed vegetables or other ingredients",
  sap: "liquid that moves through a plant or tree",
  school: "a place where students learn",
  story: "a description of events or imagined characters",
  sun: "the star that gives Earth light and heat",
  tap: "to touch something lightly and quickly",
  top: "the highest part of something",
  train: "a series of connected railway vehicles",
  urn: "a tall container, often with a narrow top",
  use: "to put something into action",
  van: "a road vehicle used for carrying goods or people",
  vase: "a container used to hold flowers",
  web: "a structure made by a spider",
  yard: "an outdoor area next to a house",
  yellow: "the color of lemons or sunflowers",
  yet: "up to this time"
};

function normalizeWordId(word: string) {
  return word.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function createMockWord({
  unitId,
  word,
  englishMeaning,
  chineseMeaning,
  displayText,
  phonetic,
  partOfSpeech = "noun",
  difficulty = 1,
  cefrLevel = "A1",
  frequencyRank,
  examples,
  tags = [],
  learningConcept
}: CreateMockWordInput): VocabularyImportWord {
  const readableWord = displayText ?? word;
  const normalizedWord = word.trim().toLowerCase();

  return {
    id: `${unitId}-${normalizeWordId(word)}`,
    word,
    displayText: readableWord,
    englishMeaning:
      englishMeaning ??
      defaultEnglishMeanings[normalizedWord] ??
      `a placeholder study meaning for ${readableWord.toLowerCase()}`,
    chineseMeaning,
    phonetic,
    partOfSpeech,
    difficulty,
    cefrLevel,
    frequencyRank,
    examples:
      examples ?? [`I can use "${readableWord}" in a short study sentence.`],
    tags,
    learningConcept
  };
}
