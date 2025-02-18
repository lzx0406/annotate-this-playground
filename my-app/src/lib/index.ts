// place files you want to import through the `$lib` alias in this folder.
export interface Prompt {
  id: number;
  title: string;
  text: string;
  date: string;
  accuracy: string;
  f1Score: string;
  precision: string;
  recall: string;
  showDetails: boolean;
  showErrors: boolean;
  adding: boolean;
}

export interface Data {
  prompts: Prompt[];
}
