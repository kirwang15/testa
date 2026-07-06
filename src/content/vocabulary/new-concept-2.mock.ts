import { createMockWord } from "./helpers";
import type { VocabularyImportBook } from "@/types/game";

export const newConcept2Mock: VocabularyImportBook = {
  id: "nce-2",
  title: "New Concept English Book 2",
  subtitle: "Daily Topics and Situations",
  description: "Mock A2 vocabulary about travel, food, and ordinary routines.",
  level: "A2",
  estimatedWordCount: 26,
  colorTheme: "coral",
  units: [
    {
      id: "nce-2-u1",
      title: "Unit 1: Travel Starter Set",
      lessonRange: "Lessons 1-6",
      difficulty: "A2",
      estimatedMinutes: 16,
      words: [
        createMockWord({ unitId: "nce-2-u1", word: "train", chineseMeaning: "火车", phonetic: "/trein/", learningConcept: "rail_transport", tags: ["transport"] }),
        createMockWord({ unitId: "nce-2-u1", word: "tap", chineseMeaning: "轻拍", partOfSpeech: "verb", learningConcept: "light_hit", tags: ["action"] }),
        createMockWord({ unitId: "nce-2-u1", word: "rug", chineseMeaning: "地毯", learningConcept: "floor_covering", tags: ["home"] }),
        createMockWord({ unitId: "nce-2-u1", word: "ink", chineseMeaning: "墨水", difficulty: 2, cefrLevel: "A2", learningConcept: "writing_liquid", tags: ["study"] }),
        createMockWord({ unitId: "nce-2-u1", word: "beach", chineseMeaning: "海滩", learningConcept: "seaside_beach", tags: ["nature"] }),
        createMockWord({ unitId: "nce-2-u1", word: "bus", chineseMeaning: "公交车", learningConcept: "road_bus", tags: ["transport"] }),
        createMockWord({ unitId: "nce-2-u1", word: "egg", chineseMeaning: "鸡蛋", learningConcept: "bird_egg", tags: ["food"] }),
        createMockWord({ unitId: "nce-2-u1", word: "air", chineseMeaning: "空气", learningConcept: "surrounding_air", tags: ["nature"] }),
        createMockWord({ unitId: "nce-2-u1", word: "cup", chineseMeaning: "杯子", learningConcept: "drinking_cup", tags: ["kitchen"] }),
        createMockWord({ unitId: "nce-2-u1", word: "hat", chineseMeaning: "帽子", learningConcept: "headwear_hat", tags: ["clothes"] }),
        createMockWord({ unitId: "nce-2-u1", word: "river", chineseMeaning: "河流", difficulty: 2, cefrLevel: "A2", learningConcept: "flowing_water", tags: ["nature"] }),
        createMockWord({ unitId: "nce-2-u1", word: "van", chineseMeaning: "货车", learningConcept: "goods_vehicle", tags: ["transport"] }),
        createMockWord({ unitId: "nce-2-u1", word: "ear", chineseMeaning: "耳朵", learningConcept: "body_part_ear", tags: ["body"] }),
        createMockWord({ unitId: "nce-2-u1", word: "red", chineseMeaning: "红色", partOfSpeech: "adjective", learningConcept: "color_red", tags: ["color"] })
      ]
    },
    {
      id: "nce-2-u2",
      title: "Unit 2: Food and Meals",
      lessonRange: "Lessons 7-12",
      difficulty: "A2",
      estimatedMinutes: 18,
      words: [
        createMockWord({ unitId: "nce-2-u2", word: "apple", chineseMeaning: "苹果", phonetic: "/ap-uhl/", learningConcept: "fruit_apple", tags: ["food"] }),
        createMockWord({ unitId: "nce-2-u2", word: "pen", chineseMeaning: "钢笔", learningConcept: "writing_pen", tags: ["study"] }),
        createMockWord({ unitId: "nce-2-u2", word: "pan", chineseMeaning: "平底锅", learningConcept: "cooking_pan", tags: ["kitchen"] }),
        createMockWord({ unitId: "nce-2-u2", word: "log", chineseMeaning: "木头", learningConcept: "cut_wood", tags: ["nature"] }),
        createMockWord({ unitId: "nce-2-u2", word: "bread", chineseMeaning: "面包", learningConcept: "baked_bread", tags: ["food"] }),
        createMockWord({ unitId: "nce-2-u2", word: "bat", chineseMeaning: "蝙蝠", learningConcept: "night_animal", tags: ["animal"] }),
        createMockWord({ unitId: "nce-2-u2", word: "dog", chineseMeaning: "狗", learningConcept: "pet_dog", tags: ["animal"] }),
        createMockWord({ unitId: "nce-2-u2", word: "salad", chineseMeaning: "沙拉", difficulty: 2, cefrLevel: "A2", learningConcept: "mixed_vegetable_dish", tags: ["food"] }),
        createMockWord({ unitId: "nce-2-u2", word: "sun", chineseMeaning: "太阳", learningConcept: "sky_sun", tags: ["nature"] }),
        createMockWord({ unitId: "nce-2-u2", word: "arm", chineseMeaning: "手臂", learningConcept: "body_part_arm", tags: ["body"] }),
        createMockWord({ unitId: "nce-2-u2", word: "plate", chineseMeaning: "盘子", learningConcept: "flat_dish", tags: ["kitchen"] }),
        createMockWord({ unitId: "nce-2-u2", word: "bowl", chineseMeaning: "碗", learningConcept: "deep_dish", tags: ["kitchen"] })
      ]
    }
  ]
};
