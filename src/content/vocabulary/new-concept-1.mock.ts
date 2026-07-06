import { createMockWord } from "./helpers";
import type { VocabularyImportBook } from "@/types/game";

export const newConcept1Mock: VocabularyImportBook = {
  id: "nce-1",
  title: "New Concept English Book 1",
  subtitle: "Starter Vocabulary Builder",
  description: "Mock beginner-friendly words for first-step vocabulary learning.",
  level: "A1",
  estimatedWordCount: 25,
  colorTheme: "mint",
  units: [
    {
      id: "nce-1-u1",
      title: "Unit 1: First Everyday Words",
      lessonRange: "Lessons 1-6",
      difficulty: "A1",
      estimatedMinutes: 12,
      words: [
        createMockWord({ unitId: "nce-1-u1", word: "cat", chineseMeaning: "猫", phonetic: "/kat/", learningConcept: "pet_animal", tags: ["animal"] }),
        createMockWord({ unitId: "nce-1-u1", word: "car", chineseMeaning: "汽车", learningConcept: "road_vehicle", tags: ["transport"] }),
        createMockWord({ unitId: "nce-1-u1", word: "ant", chineseMeaning: "蚂蚁", learningConcept: "small_insect", tags: ["animal"] }),
        createMockWord({ unitId: "nce-1-u1", word: "top", chineseMeaning: "顶部", partOfSpeech: "noun", learningConcept: "position_top", tags: ["position"] }),
        createMockWord({ unitId: "nce-1-u1", word: "bag", chineseMeaning: "包", learningConcept: "carry_container", tags: ["object"] }),
        createMockWord({ unitId: "nce-1-u1", word: "bat", chineseMeaning: "蝙蝠", learningConcept: "night_animal", tags: ["animal"] }),
        createMockWord({ unitId: "nce-1-u1", word: "arm", chineseMeaning: "手臂", learningConcept: "body_part_arm", tags: ["body"] }),
        createMockWord({ unitId: "nce-1-u1", word: "gem", chineseMeaning: "宝石", difficulty: 2, cefrLevel: "A2", learningConcept: "valuable_stone", tags: ["object"] }),
        createMockWord({ unitId: "nce-1-u1", word: "sun", chineseMeaning: "太阳", learningConcept: "sky_sun", tags: ["nature"] }),
        createMockWord({ unitId: "nce-1-u1", word: "sap", chineseMeaning: "树液", difficulty: 2, cefrLevel: "A2", learningConcept: "plant_liquid", tags: ["nature"] }),
        createMockWord({ unitId: "nce-1-u1", word: "urn", chineseMeaning: "瓮", difficulty: 2, cefrLevel: "A2", learningConcept: "narrow_container", tags: ["object"] }),
        createMockWord({ unitId: "nce-1-u1", word: "net", chineseMeaning: "网", learningConcept: "net_material", tags: ["object"] })
      ]
    },
    {
      id: "nce-1-u2",
      title: "Unit 2: Home and Objects",
      lessonRange: "Lessons 7-12",
      difficulty: "A1",
      estimatedMinutes: 14,
      words: [
        createMockWord({ unitId: "nce-1-u2", word: "book", chineseMeaning: "书", phonetic: "/buk/", learningConcept: "reading_book", tags: ["study"] }),
        createMockWord({ unitId: "nce-1-u2", word: "bell", chineseMeaning: "铃", learningConcept: "ringing_object", tags: ["home"] }),
        createMockWord({ unitId: "nce-1-u2", word: "oven", chineseMeaning: "烤箱", learningConcept: "kitchen_oven", tags: ["kitchen"] }),
        createMockWord({ unitId: "nce-1-u2", word: "okay", chineseMeaning: "可以", partOfSpeech: "adjective", learningConcept: "state_okay", tags: ["expression"] }),
        createMockWord({ unitId: "nce-1-u2", word: "king", chineseMeaning: "国王", learningConcept: "male_ruler", tags: ["people"] }),
        createMockWord({ unitId: "nce-1-u2", word: "hand", chineseMeaning: "手", learningConcept: "body_part_hand", tags: ["body"] }),
        createMockWord({ unitId: "nce-1-u2", word: "hat", chineseMeaning: "帽子", learningConcept: "headwear_hat", tags: ["clothes"] }),
        createMockWord({ unitId: "nce-1-u2", word: "nest", chineseMeaning: "鸟巢", learningConcept: "bird_home", tags: ["nature"] }),
        createMockWord({ unitId: "nce-1-u2", word: "dog", chineseMeaning: "狗", learningConcept: "pet_dog", tags: ["animal"] }),
        createMockWord({ unitId: "nce-1-u2", word: "fish", chineseMeaning: "鱼", learningConcept: "water_animal", tags: ["animal"] }),
        createMockWord({ unitId: "nce-1-u2", word: "fan", chineseMeaning: "风扇", learningConcept: "air_tool", tags: ["home"] }),
        createMockWord({ unitId: "nce-1-u2", word: "ink", chineseMeaning: "墨水", difficulty: 2, cefrLevel: "A2", learningConcept: "writing_liquid", tags: ["study"] }),
        createMockWord({ unitId: "nce-1-u2", word: "hen", chineseMeaning: "母鸡", learningConcept: "female_chicken", tags: ["animal"] })
      ]
    }
  ]
};
