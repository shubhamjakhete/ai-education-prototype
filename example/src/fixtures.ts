// Made-up data for the workshop demo. These students and this trip do not exist.
import type { StudentProfile } from './agenda-checker';

export const SAMPLE_PROFILES: StudentProfile[] = [
  {
    id: 'malia',
    name: 'Malia',
    familyAgreed: true,
    lines: [
      { need: 'step-free', shared: 'Yes', text: "Uses a wheelchair and moves on her own; doesn't want to be pushed unless she asks" },
      { need: 'lift-transport', shared: 'Yes', text: 'Needs a bus with a working wheelchair lift' },
      { need: 'visual-info', shared: 'Yes', text: 'Loves maps and likes to see the route ahead of time' },
      { need: null, shared: 'No', text: 'Details of her care routine during the day' },
    ],
  },
  {
    id: 'theo',
    name: 'Theo',
    familyAgreed: true,
    lines: [
      { need: 'noise', shared: 'Yes', text: 'Finds loud, crowded spaces hard and uses ear defenders' },
      { need: null, shared: 'No', text: 'Background on why noise is hard for him' },
    ],
  },
  {
    id: 'sam',
    name: 'Sam',
    familyAgreed: true,
    lines: [
      { need: 'transition-time', shared: 'Yes', text: 'Does best with a heads-up and a few extra minutes between activities' },
    ],
  },
  {
    id: 'jordan',
    name: 'Jordan',
    familyAgreed: false,
    lines: [
      { need: 'step-free', shared: 'Yes', text: 'Uses crutches on long walks' },
    ],
  },
];

export const SAMPLE_AGENDA = `Pond study - Thursday, Willow Creek Nature Center
8:30 School bus leaves from the front loop
9:15 Welcome talk with other school groups in the amphitheater
9:45 Walk down the steps to the pond
9:50 Class collects water samples at the pond edge; Malia waits at the bench with her aide
11:30 Lunch at the picnic tables
12:15 Hike the ridge trail back to the visitor center
1:45 Bus returns to school
Note: the nature center website says the site is "mostly accessible"`;
