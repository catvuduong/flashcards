// The four study buttons. Labels map onto SM-2 grades (0-5); keys 1-4 pick a button.
export const GRADES = [
  { grade: 1, label: 'Again', key: '1', testId: 'grade-again', tone: 'again' },
  { grade: 3, label: 'Hard', key: '2', testId: 'grade-hard', tone: 'hard' },
  { grade: 4, label: 'Good', key: '3', testId: 'grade-good', tone: 'good' },
  { grade: 5, label: 'Easy', key: '4', testId: 'grade-easy', tone: 'easy' },
] as const;

export type GradeValue = (typeof GRADES)[number]['grade'];
