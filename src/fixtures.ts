// Fictional school data only. No real people, schools, or links.

export interface SchoolClass {
  id: string;
  subject: string;
  teacher: string; // fictional teacher name
  period: string;
  todayObjective: string; // from the fictional course calendar
  tutorial: string; // fictional tutorial title (not a real link)
}

export const SCHEDULE: SchoolClass[] = [
  { id: 'math', subject: 'Math', teacher: 'Mx. Lee', period: '1st period', todayObjective: 'Add and subtract fractions with unlike denominators.', tutorial: 'Fractions review video (fictional)' },
  { id: 'english', subject: 'English', teacher: 'Ms. Ortiz', period: '2nd period', todayObjective: 'Find the main idea in a short story.', tutorial: 'Main idea practice (fictional)' },
  { id: 'science', subject: 'Science', teacher: 'Mr. Okafor', period: '3rd period', todayObjective: 'Name the parts of a plant cell.', tutorial: 'Plant cell diagram walkthrough (fictional)' },
  { id: 'history', subject: 'History', teacher: 'Ms. Brandt', period: '4th period', todayObjective: 'Put five events on a timeline.', tutorial: 'Timeline basics (fictional)' },
  { id: 'art', subject: 'Art', teacher: 'Mr. Silva', period: '5th period', todayObjective: 'Sketch a still life using basic shapes.', tutorial: 'Shapes to drawings (fictional)' },
  { id: 'pe', subject: 'PE', teacher: 'Coach Haddad', period: '6th period', todayObjective: 'Team stretching and a light walking game.', tutorial: 'Stretching routine (fictional)' },
];

export const SCHOOL_PLACES: string[] = [
  'Bathrooms: next to Room 10 and by the gym.',
  'Library: second floor, above the main office.',
  'Cafeteria: end of the main hall.',
  'Nurse: Room 4, next to the main office.',
  'Quiet room for rest: Room 6.',
];

export const EXAMPLE = {
  preferredName: 'Sam',
  restTimes: 'Goes to the nurse at 11:30. May need to rest after lunch.',
  sourceNote: { source: 'Greeter helper (fictional)', text: 'Asked where the library is. Said mornings feel easier.' },
};
