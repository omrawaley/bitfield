export interface LayoutLink {
  label: string;
  href: string;
}

export interface ChipLayoutSource {
  generatedBy: string;
  image: { src: string; alt: string };
  links?: LayoutLink[];
}

// Published by the `pages` job of .github/workflows/gds.yaml: it deploys the
// website plus the hardened layout under /gds/ (gds_render.png, the GDS and
// the OAS). Enable Pages once (Settings -> Pages -> Source: "GitHub Actions")
// and this turns on automatically after the first successful GDS build.
const PAGES = 'https://omrawaley.github.io/bitfield';

export const layoutSource: ChipLayoutSource = {
  generatedBy: 'Tiny Tapeout GDS action — LibreLane on sky130A, GitHub Actions',
  image: {
    src: `${PAGES}/gds/gds_render.png`,
    alt: 'Rendered sky130 layout of the BITFIELD die: standard cells, routing and the Tiny Tapeout I/O ring',
  },
  links: [
    { label: '3D viewer ↗', href: `${PAGES}/gds/` },
    {
      label: 'GDS Explorer ↗',
      href: `https://gds-explorer.tinytapeout.com/viewer?file=${encodeURIComponent(`${PAGES}/gds/tinytapeout.oas`)}&pdk=sky130A`,
    },
  ],
};
