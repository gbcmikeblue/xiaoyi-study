export type Subject = 'chinese' | 'math' | 'english';

export interface VolumeMeta {
  id: string;
  subject: Subject;
  grade: number;
  term: 'up' | 'down';
  edition: string;
  editionYear: string;
  title: string;
  unitCount: number;
  ready: boolean;
}

export interface LessonMeta {
  id: string;
  order: number;
  title: string;
}

export interface UnitMeta {
  id: string;
  volumeId: string;
  order: number;
  title: string;
  lessons: LessonMeta[];
}

export interface CharItem {
  char: string;
  pinyin: string;
  word?: string;
  audioSrc?: string;
}

export interface WordItem {
  text: string;
  meaning?: string;
  audioSrc?: string;
}

export type Block =
  | { type: 'text'; title?: string; content: string }
  | { type: 'chars'; items: CharItem[] }
  | { type: 'words'; items: WordItem[] }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'audio'; src?: string; text: string; caption?: string };

export type ExerciseType = 'single' | 'multi' | 'listen';

export interface ExerciseOption {
  id: string;
  label: string;
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  stem: string;
  speakText?: string;
  options: ExerciseOption[];
  answer: string[];
  explanation?: string;
  /** 指定玩法（场景 id）；缺省时使用全局偏好与默认场景 */
  scene?: string;
}

export interface Lesson {
  id: string;
  unitId: string;
  volumeId: string;
  title: string;
  objectives: string[];
  blocks: Block[];
  exercises: Exercise[];
}

export interface LessonRecord {
  status: 'doing' | 'done';
  score: number;
  total: number;
  updatedAt: number;
}

export type ProgressMap = Record<string, Record<string, LessonRecord>>;

export interface Draft {
  volumeId: string;
  lessonId: string;
  step: number;
  exerciseIndex: number;
  answers: Record<string, string[]>;
  checked: Record<string, boolean>;
  updatedAt: number;
}
