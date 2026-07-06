import { createMockWord } from "./helpers";
import type { VocabularyImportBook } from "@/types/game";

export const newConcept4Mock: VocabularyImportBook = {
  id: "nce-4",
  title: "New Concept English Book 4",
  subtitle: "Ideas, Stories, and Abstract Topics",
  description: "Mock B2 vocabulary groups that prepare the platform for more advanced study packs.",
  level: "B2",
  estimatedWordCount: 24,
  colorTheme: "gold",
  units: [
    {
      id: "nce-4-u1",
      title: "Unit 1: Ideas and Memory",
      lessonRange: "Lessons 1-8",
      difficulty: "B2",
      estimatedMinutes: 22,
      words: [
        createMockWord({ unitId: "nce-4-u1", word: "future", chineseMeaning: "未来", phonetic: "/fyu-cher/", difficulty: 2, cefrLevel: "B2", learningConcept: "future_time", tags: ["abstract"] }),
        createMockWord({ unitId: "nce-4-u1", word: "memory", chineseMeaning: "记忆", difficulty: 2, cefrLevel: "B2", learningConcept: "ability_to_remember", tags: ["mind"] }),
        createMockWord({ unitId: "nce-4-u1", word: "dream", chineseMeaning: "梦想", difficulty: 2, cefrLevel: "B2", learningConcept: "dream_or_wish", tags: ["mind"] }),
        createMockWord({ unitId: "nce-4-u1", word: "fan", chineseMeaning: "风扇", learningConcept: "air_tool", tags: ["home"] }),
        createMockWord({ unitId: "nce-4-u1", word: "urn", chineseMeaning: "瓮", difficulty: 2, cefrLevel: "B2", learningConcept: "narrow_container", tags: ["object"] }),
        createMockWord({ unitId: "nce-4-u1", word: "use", chineseMeaning: "使用", partOfSpeech: "verb", cefrLevel: "B2", learningConcept: "put_into_action", tags: ["action"] }),
        createMockWord({ unitId: "nce-4-u1", word: "map", chineseMeaning: "地图", learningConcept: "place_map", tags: ["travel"] }),
        createMockWord({ unitId: "nce-4-u1", word: "man", chineseMeaning: "男人", learningConcept: "adult_male", tags: ["people"] }),
        createMockWord({ unitId: "nce-4-u1", word: "oil", chineseMeaning: "油", difficulty: 2, cefrLevel: "B2", learningConcept: "thick_liquid", tags: ["material"] }),
        createMockWord({ unitId: "nce-4-u1", word: "red", chineseMeaning: "红色", partOfSpeech: "adjective", learningConcept: "color_red", tags: ["color"] }),
        createMockWord({ unitId: "nce-4-u1", word: "yet", chineseMeaning: "还", partOfSpeech: "adverb", difficulty: 2, cefrLevel: "B2", learningConcept: "up_to_now", tags: ["time"] }),
        createMockWord({ unitId: "nce-4-u1", word: "ear", chineseMeaning: "耳朵", learningConcept: "body_part_ear", tags: ["body"] })
      ]
    },
    {
      id: "nce-4-u2",
      title: "Unit 2: Stories and Characters",
      lessonRange: "Lessons 9-16",
      difficulty: "B2",
      estimatedMinutes: 24,
      words: [
        createMockWord({ unitId: "nce-4-u2", word: "story", chineseMeaning: "故事", phonetic: "/stor-ee/", cefrLevel: "B2", learningConcept: "story_narrative", tags: ["story"] }),
        createMockWord({ unitId: "nce-4-u2", word: "actor", chineseMeaning: "演员", difficulty: 2, cefrLevel: "B2", learningConcept: "performing_actor", tags: ["people"] }),
        createMockWord({ unitId: "nce-4-u2", word: "novel", chineseMeaning: "小说", difficulty: 2, cefrLevel: "B2", learningConcept: "written_novel", tags: ["story"] }),
        createMockWord({ unitId: "nce-4-u2", word: "sun", chineseMeaning: "太阳", learningConcept: "sky_sun", tags: ["nature"] }),
        createMockWord({ unitId: "nce-4-u2", word: "top", chineseMeaning: "顶部", learningConcept: "position_top", tags: ["position"] }),
        createMockWord({ unitId: "nce-4-u2", word: "rat", chineseMeaning: "老鼠", learningConcept: "small_rodent", tags: ["animal"] }),
        createMockWord({ unitId: "nce-4-u2", word: "yellow", chineseMeaning: "黄色", partOfSpeech: "adjective", learningConcept: "color_yellow", tags: ["color"] }),
        createMockWord({ unitId: "nce-4-u2", word: "yard", chineseMeaning: "院子", learningConcept: "outdoor_area", tags: ["home"] }),
        createMockWord({ unitId: "nce-4-u2", word: "easy", chineseMeaning: "容易的", partOfSpeech: "adjective", learningConcept: "not_hard", tags: ["quality"] }),
        createMockWord({ unitId: "nce-4-u2", word: "apple", chineseMeaning: "苹果", learningConcept: "fruit_apple", tags: ["food"] }),
        createMockWord({ unitId: "nce-4-u2", word: "vase", chineseMeaning: "花瓶", difficulty: 2, cefrLevel: "B2", learningConcept: "flower_container", tags: ["home"] }),
        createMockWord({ unitId: "nce-4-u2", word: "north", chineseMeaning: "北方", difficulty: 2, cefrLevel: "B2", learningConcept: "north_direction", tags: ["direction"] })
      ]
    }
  ]
};
