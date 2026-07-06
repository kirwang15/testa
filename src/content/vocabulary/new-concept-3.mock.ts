import { createMockWord } from "./helpers";
import type { VocabularyImportBook } from "@/types/game";

export const newConcept3Mock: VocabularyImportBook = {
  id: "nce-3",
  title: "New Concept English Book 3",
  subtitle: "School and Nature Themes",
  description: "Mock B1 vocabulary sets that keep the puzzle flow while preparing richer study data.",
  level: "B1",
  estimatedWordCount: 24,
  colorTheme: "leaf",
  units: [
    {
      id: "nce-3-u1",
      title: "Unit 1: Study Words",
      lessonRange: "Lessons 1-10",
      difficulty: "B1",
      estimatedMinutes: 18,
      words: [
        createMockWord({ unitId: "nce-3-u1", word: "school", chineseMeaning: "学校", phonetic: "/skul/", cefrLevel: "B1", learningConcept: "place_of_learning", tags: ["study"] }),
        createMockWord({ unitId: "nce-3-u1", word: "lesson", chineseMeaning: "课程", cefrLevel: "B1", learningConcept: "teaching_period", tags: ["study"] }),
        createMockWord({ unitId: "nce-3-u1", word: "pencil", chineseMeaning: "铅笔", cefrLevel: "B1", learningConcept: "writing_pencil", tags: ["study"] }),
        createMockWord({ unitId: "nce-3-u1", word: "cat", chineseMeaning: "猫", learningConcept: "pet_animal", tags: ["animal"] }),
        createMockWord({ unitId: "nce-3-u1", word: "hat", chineseMeaning: "帽子", learningConcept: "headwear_hat", tags: ["clothes"] }),
        createMockWord({ unitId: "nce-3-u1", word: "oil", chineseMeaning: "油", difficulty: 2, cefrLevel: "B1", learningConcept: "thick_liquid", tags: ["material"] }),
        createMockWord({ unitId: "nce-3-u1", word: "oak", chineseMeaning: "橡树", difficulty: 2, cefrLevel: "B1", learningConcept: "oak_tree", tags: ["nature"] }),
        createMockWord({ unitId: "nce-3-u1", word: "log", chineseMeaning: "木头", learningConcept: "cut_wood", tags: ["nature"] }),
        createMockWord({ unitId: "nce-3-u1", word: "ear", chineseMeaning: "耳朵", learningConcept: "body_part_ear", tags: ["body"] }),
        createMockWord({ unitId: "nce-3-u1", word: "net", chineseMeaning: "网", learningConcept: "net_material", tags: ["object"] }),
        createMockWord({ unitId: "nce-3-u1", word: "cup", chineseMeaning: "杯子", learningConcept: "drinking_cup", tags: ["kitchen"] }),
        createMockWord({ unitId: "nce-3-u1", word: "ink", chineseMeaning: "墨水", difficulty: 2, cefrLevel: "B1", learningConcept: "writing_liquid", tags: ["study"] })
      ]
    },
    {
      id: "nce-3-u2",
      title: "Unit 2: Nature Vocabulary",
      lessonRange: "Lessons 11-20",
      difficulty: "B1",
      estimatedMinutes: 20,
      words: [
        createMockWord({ unitId: "nce-3-u2", word: "flower", chineseMeaning: "花", phonetic: "/flou-er/", cefrLevel: "B1", learningConcept: "plant_flower", tags: ["nature"] }),
        createMockWord({ unitId: "nce-3-u2", word: "forest", chineseMeaning: "森林", difficulty: 2, cefrLevel: "B1", learningConcept: "large_tree_area", tags: ["nature"] }),
        createMockWord({ unitId: "nce-3-u2", word: "garden", chineseMeaning: "花园", cefrLevel: "B1", learningConcept: "plant_garden", tags: ["nature"] }),
        createMockWord({ unitId: "nce-3-u2", word: "fan", chineseMeaning: "风扇", learningConcept: "air_tool", tags: ["home"] }),
        createMockWord({ unitId: "nce-3-u2", word: "oil", chineseMeaning: "油", difficulty: 2, cefrLevel: "B1", learningConcept: "thick_liquid", tags: ["material"] }),
        createMockWord({ unitId: "nce-3-u2", word: "web", chineseMeaning: "蜘蛛网", difficulty: 2, cefrLevel: "B1", learningConcept: "spider_web", tags: ["nature"] }),
        createMockWord({ unitId: "nce-3-u2", word: "rat", chineseMeaning: "老鼠", learningConcept: "small_rodent", tags: ["animal"] }),
        createMockWord({ unitId: "nce-3-u2", word: "oak", chineseMeaning: "橡树", difficulty: 2, cefrLevel: "B1", learningConcept: "oak_tree", tags: ["nature"] }),
        createMockWord({ unitId: "nce-3-u2", word: "rug", chineseMeaning: "地毯", learningConcept: "floor_covering", tags: ["home"] }),
        createMockWord({ unitId: "nce-3-u2", word: "sun", chineseMeaning: "太阳", learningConcept: "sky_sun", tags: ["nature"] }),
        createMockWord({ unitId: "nce-3-u2", word: "top", chineseMeaning: "顶部", learningConcept: "position_top", tags: ["position"] }),
        createMockWord({ unitId: "nce-3-u2", word: "gem", chineseMeaning: "宝石", difficulty: 2, cefrLevel: "B1", learningConcept: "valuable_stone", tags: ["object"] })
      ]
    }
  ]
};
