export interface LayoutLayer {
  id: string;
  name: string;
  color: string;
}

export interface LayoutLink {
  label: string;
  href: string;
}

export interface ChipLayoutSource {
  generatedBy: string;
  image?: { src: string; alt: string };
  links?: LayoutLink[];
  model?: { src: string; layers: LayoutLayer[] };
}

// Published by the `viewer` job of .github/workflows/gds.yaml: it deploys
// the rendered layout (gds_render.png) plus the GDS/OAS files to GitHub
// Pages. Enable Pages once (Settings -> Pages -> Source: "GitHub Actions")
// and this turns on automatically after the first successful GDS build.
const PAGES = 'https://omrawaley.github.io/bitfield';

export const layoutSource: ChipLayoutSource | null = {
  generatedBy: 'Tiny Tapeout GDS action — LibreLane on sky130A, GitHub Actions',
  image: {
    src: `${PAGES}/gds_render.png`,
    alt: 'Rendered sky130 layout of the BITFIELD die: standard cells, routing and the Tiny Tapeout I/O ring',
  },
  links: [
    { label: '3D viewer ↗', href: `${PAGES}/` },
    {
      label: 'GDS Explorer ↗',
      href: `https://gds-explorer.tinytapeout.com/viewer?file=${encodeURIComponent(`${PAGES}/tinytapeout.oas`)}&pdk=sky130A`,
    },
  ],
};
