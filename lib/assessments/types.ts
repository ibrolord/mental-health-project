export interface AssessmentQuestion {
  id: string;
  text: string;
  options: {
    value: number;
    label: string;
  }[];
}

export interface Assessment {
  type: 'GAD7' | 'PHQ9' | 'CBI' | 'PSS4';
  name: string;
  description: string;
  questions: AssessmentQuestion[];
  maxScore: number;
  interpret: (score: number) => {
    level: string;
    message: string;
    suggestions: string[];
  };
}

