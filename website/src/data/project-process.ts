export interface Measurement {
  label: string;
  value: string;
  unit?: string;
  source: string;
}

export interface JournalEntry {
  id: string;
  phase: string;
  status: 'pending' | 'documented';
  date?: string;
  title?: string;
  body?: string[];
  code?: { source: string; caption?: string };
  image?: { src: string; alt: string; caption?: string };
  measurements?: Measurement[];
  prompt: string;
}

export const JOURNAL: JournalEntry[] = [
  { id: 'concept', phase: 'Initial concept', status: 'pending', prompt: 'What was the first idea? Why art from hardware, and why without stored images or AI?' },
  { id: 'inspiration', phase: 'Mathematical inspiration', status: 'pending', prompt: 'Which formulas, artists or demoscene effects did you start from? Include the first formula you tried.' },
  { id: 'verilog', phase: 'Verilog implementation', status: 'pending', prompt: 'How is the design structured (timing generator, pattern logic, colour output)? Paste the key always/assign block.' },
  { id: 'simulation', phase: 'Simulation', status: 'pending', prompt: 'How did you first see the picture? Add a screenshot of the first frame that worked.' },
  { id: 'testing', phase: 'Testing', status: 'pending', prompt: 'What did you test, and how (cocotb, waveform inspection, frame comparison)? What did the tests catch?' },
  { id: 'synthesis', phase: 'Synthesis', status: 'pending', prompt: 'Cell count and area from the synthesis report. Did anything surprise you, such as a multiplier being large?' },
  { id: 'physical', phase: 'Physical design', status: 'pending', prompt: 'Placement and routing results: utilisation, timing slack, DRC/LVS status. Add the layout render.' },
  { id: 'challenges', phase: 'Challenges', status: 'pending', prompt: 'What was hardest? Be specific: the bug, the symptom, the cause.' },
  { id: 'mistakes', phase: 'Mistakes', status: 'pending', prompt: 'What went wrong, and what did you learn from it?' },
  { id: 'improvements', phase: 'Improvements', status: 'pending', prompt: 'What changed between the first and the final version, and why?' },
  { id: 'results', phase: 'Final results', status: 'pending', prompt: 'What does the finished design do? Include measured numbers and their source.' },
];
