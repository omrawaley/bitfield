export interface LayoutLayer {
  id: string;
  name: string;
  color: string;
}

export interface ChipLayoutSource {
  generatedBy: string;
  image?: { src: string; alt: string };
  model?: { src: string; layers: LayoutLayer[] };
}

export const layoutSource: ChipLayoutSource | null = null;
