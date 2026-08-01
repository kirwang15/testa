import type { VocabularyImportBook, VocabularyImportWord } from "@/types/game";

export const EDITORIAL_OVERRIDE_VERSION = "owner-sense-corrections-v2";

type EditorialFields = Pick<
  VocabularyImportWord,
  "englishMeaning" | "chineseMeaning" | "partOfSpeech" | "examples"
>;

/**
 * Owner/editorial corrections only. They deliberately do not promote
 * reviewStatus: every entry remains automated until the product owner signs it
 * off outside this repository.
 */
export const editorialWordOverrides: Record<string, EditorialFields> = {
  "nce-1997-b1-suit": {
    englishMeaning: "To meet a person's needs or be right for a purpose",
    chineseMeaning: "适合，合适",
    partOfSpeech: "verb",
    examples: ["This quiet room will suit our study group." ]
  },
  "nce-1997-b1-rusty": {
    englishMeaning: "Covered with a reddish-brown layer caused by damp air",
    chineseMeaning: "生锈的",
    partOfSpeech: "adjective",
    examples: ["The rusty gate squeaked when it opened."]
  },
  "nce-1997-b1-electric": {
    englishMeaning: "Powered by energy flowing through wires or batteries",
    chineseMeaning: "用电的，电动的",
    partOfSpeech: "adjective",
    examples: ["The electric lamp glowed beside the bed."]
  },
  "nce-1997-b1-armchair": {
    englishMeaning: "A padded seat with side supports for resting your arms",
    chineseMeaning: "扶手椅",
    partOfSpeech: "noun",
    examples: ["Grandpa read quietly in the soft armchair."]
  },
  "nce-1997-b1-sorry": {
    englishMeaning: "An exclamation used to apologize after a mistake",
    chineseMeaning: "对不起（表示歉意）",
    partOfSpeech: "interjection",
    examples: ["Sorry, I knocked over your cup."]
  },
  "nce-1997-b1-name": {
    englishMeaning: "The word by which a person or thing is known",
    chineseMeaning: "名字，名称",
    partOfSpeech: "noun",
    examples: ["Please write your name on the card."]
  },
  "nce-1997-b1-whose": {
    englishMeaning: "A question word used to ask who owns something",
    chineseMeaning: "谁的",
    partOfSpeech: "pronoun",
    examples: ["Whose blue backpack is by the door?"]
  },
  "nce-1997-b1-mum": {
    englishMeaning: "An informal British word for a mother",
    chineseMeaning: "妈妈（英式口语）",
    partOfSpeech: "noun",
    examples: ["My mum packed fruit for the picnic."]
  },
  "nce-1997-b1-children": {
    englishMeaning: "More than one young person",
    chineseMeaning: "孩子们（child 的复数）",
    partOfSpeech: "noun",
    examples: ["The children built a tower together."]
  },
  "nce-1997-b1-one": {
    englishMeaning: "The number immediately after zero",
    chineseMeaning: "一，一个",
    partOfSpeech: "number",
    examples: ["I need one pencil for the activity."]
  },
  "nce-1997-b1-family": {
    englishMeaning: "People related to each other who form a household",
    chineseMeaning: "家庭，家人",
    partOfSpeech: "noun",
    examples: ["Our family eats dinner together on Sundays."]
  },
  "nce-1997-b1-goodbye": {
    englishMeaning: "An exclamation said when someone is leaving",
    chineseMeaning: "再见",
    partOfSpeech: "interjection",
    examples: ["Goodbye, I will see you tomorrow."]
  },
  "nce-1997-b1-colour": {
    englishMeaning: "A quality such as red, blue, or green",
    chineseMeaning: "颜色（英式拼写）",
    partOfSpeech: "noun",
    examples: ["Blue is her favourite colour."]
  },
  "nce-1997-b1-room": {
    englishMeaning: "An enclosed part of a building used for an activity",
    chineseMeaning: "房间",
    partOfSpeech: "noun",
    examples: ["The room has space for two desks."]
  },
  "nce-1997-b1-door": {
    englishMeaning: "A movable panel used to enter or leave a place",
    chineseMeaning: "门",
    partOfSpeech: "noun",
    examples: ["Please close the door before you leave."]
  },
  "nce-1997-b1-window": {
    englishMeaning: "An opening in a wall, usually fitted with glass",
    chineseMeaning: "窗户",
    partOfSpeech: "noun",
    examples: ["Sunlight came through the open window."]
  },
  "nce-1997-b3-raid": {
    englishMeaning: "A sudden organized attack or search",
    chineseMeaning: "突袭，突然搜查",
    partOfSpeech: "noun",
    examples: ["Police carried out a dawn raid on the warehouse."]
  },
  "nce-1997-b2-helper": {
    englishMeaning: "A person who assists someone with a task",
    chineseMeaning: "助手，帮手",
    partOfSpeech: "noun",
    examples: ["The helper carried the boxes into the hall."]
  },
  "nce-1997-b2-swimmer": {
    englishMeaning: "A person moving through water for exercise or sport",
    chineseMeaning: "游泳者",
    partOfSpeech: "noun",
    examples: ["The swimmer reached the far side of the pool."]
  },
  "nce-1997-b2-villager": {
    englishMeaning: "A person living in a small rural community",
    chineseMeaning: "村民",
    partOfSpeech: "noun",
    examples: ["A villager showed us the path to the river."]
  },
  "nce-1997-b2-shady": {
    englishMeaning: "Protected from direct sunlight",
    chineseMeaning: "背阴的，阴凉的",
    partOfSpeech: "adjective",
    examples: ["We rested in a shady corner of the garden."]
  },
  "nce-1997-b2-diver": {
    englishMeaning: "A person trained to explore underwater",
    chineseMeaning: "潜水员",
    partOfSpeech: "noun",
    examples: ["The diver photographed fish below the boat."]
  },
  "nce-1997-b3-suspension": {
    englishMeaning: "The state of hanging freely from a support",
    chineseMeaning: "悬挂，悬浮",
    partOfSpeech: "noun",
    examples: ["The bridge uses suspension cables above the river."]
  },
  "nce-1997-b3-belongings": {
    englishMeaning: "The personal possessions owned by someone",
    chineseMeaning: "所有物，随身物品",
    partOfSpeech: "noun",
    examples: ["She packed her belongings before moving house."]
  },
  "nce-1997-b3-sticky": {
    englishMeaning: "Able to cling to surfaces because of a tacky texture",
    chineseMeaning: "黏的，黏性的",
    partOfSpeech: "adjective",
    examples: ["The sticky label would not come off the jar."]
  },
  "nce-1997-b3-grudge": {
    englishMeaning: "To be unwilling to give or allow something",
    chineseMeaning: "不愿给，舍不得给",
    partOfSpeech: "verb",
    examples: ["She did not grudge him the extra time."]
  },
  "nce-1997-b3-capture": {
    englishMeaning: "To attract and hold someone's attention",
    chineseMeaning: "吸引，赢得",
    partOfSpeech: "verb",
    examples: ["The vivid opening can capture a reader's attention."]
  },
  "nce-1997-b3-listeria": {
    englishMeaning: "A bacterium that can cause illness through contaminated food",
    chineseMeaning: "利斯特菌",
    partOfSpeech: "noun",
    examples: ["Cooking food thoroughly helps prevent listeria infection."]
  },
  "nce-1997-b4-confine": {
    englishMeaning: "To keep someone or something within a limited area",
    chineseMeaning: "限制，把……局限于",
    partOfSpeech: "verb",
    examples: ["Please confine your comments to the main issue."]
  },
  "nce-1997-b4-penalize": {
    englishMeaning: "To punish someone for breaking a rule",
    chineseMeaning: "处罚，惩罚",
    partOfSpeech: "verb",
    examples: ["The referee may penalize a player for dangerous behaviour."]
  },
  "nce-1997-b4-morality": {
    englishMeaning: "Principles about what behaviour is right or wrong",
    chineseMeaning: "道德，道德准则",
    partOfSpeech: "noun",
    examples: ["The story raises a question about morality."]
  },
  "nce-1997-b4-riot": {
    englishMeaning: "A vivid and abundant display of colours",
    chineseMeaning: "丰富多彩，绚丽",
    partOfSpeech: "noun",
    examples: ["The garden was a riot of colour in spring."]
  },
  "nce-1997-b4-slander": {
    englishMeaning: "To make a false spoken claim that harms someone",
    chineseMeaning: "诽谤，口头中伤",
    partOfSpeech: "verb",
    examples: ["They refused to slander anyone during the debate."]
  },
  "nce-1997-b4-pagan": {
    englishMeaning: "A follower of a religion outside the world's main traditions",
    chineseMeaning: "异教徒",
    partOfSpeech: "noun",
    examples: ["The museum label described an ancient pagan tradition."]
  },
  "nce-1997-b4-aberrant": {
    englishMeaning: "Different from what is normal or expected",
    chineseMeaning: "异常的，偏离常规的",
    partOfSpeech: "adjective",
    examples: ["The sensor recorded one aberrant reading during the test."]
  },
  "nce-1997-b4-wreck": {
    englishMeaning: "A person in a severely weakened physical or mental state",
    chineseMeaning: "身心状况很差的人",
    partOfSpeech: "noun",
    examples: ["After the sleepless week, he felt like a wreck."]
  }
};

export function applyEditorialOverrides(
  books: VocabularyImportBook[]
): VocabularyImportBook[] {
  const applied = new Set<string>();
  const corrected = books.map((book) => ({
    ...book,
    units: book.units.map((unit) => ({
      ...unit,
      words: unit.words.map((word) => {
        const override = editorialWordOverrides[word.id];
        if (!override) return word;
        applied.add(word.id);
        return { ...word, ...override };
      })
    }))
  }));
  const missing = Object.keys(editorialWordOverrides).filter((id) => !applied.has(id));
  if (missing.length > 0) {
    throw new Error(`Editorial overrides reference missing words: ${missing.join(", ")}`);
  }
  return corrected;
}
