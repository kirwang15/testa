export type AIWordExplanationRequest = {
  wordId: string;
  promptStyle?: "simple" | "detailed";
};

export type AIWordExplanationResponse = {
  wordId: string;
  explanation: string;
  examples?: string[];
};

export type AIExampleRequest = {
  wordId: string;
  difficulty?: "easy" | "medium" | "hard";
};

export type AIWordCoachMessage = {
  wordId: string;
  message: string;
  tone?: "encouraging" | "direct" | "playful";
};

export type AIWordLearningProvider = {
  explainWord: (request: AIWordExplanationRequest) => Promise<AIWordExplanationResponse>;
  generateExamples: (request: AIExampleRequest) => Promise<string[]>;
  coachWord: (wordId: string) => Promise<AIWordCoachMessage>;
};
