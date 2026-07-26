export interface AssessmentQuestion {
  id: string;
  text: string;
  contextLabel?: string;
  options: {
    value: number;
    label: string;
  }[];
}

export interface Assessment {
  type: 'GAD7' | 'PHQ9' | 'CBI';
  name: string;
  shortName: string;
  description: string;
  measureType: 'Validated symptom screener' | 'Validated self-report measure';
  timeframe: string;
  instructions: string;
  scoreMeaning: string;
  source: string;
  citationUrl: string;
  reviewedAt: string;
  questions: AssessmentQuestion[];
  functioningQuestion?: AssessmentQuestion;
  maxScore: number;
  calculateScore: (responses: Record<string, number>) => number;
  interpret: (score: number) => {
    level: string;
    message: string;
    suggestions: string[];
  };
}
