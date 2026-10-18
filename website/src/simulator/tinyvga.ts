export interface VgaPins {
  hsync: number;
  vsync: number;
  r: number;
  g: number;
  b: number;
}

export function decodeTinyVGA(uo: number): VgaPins {
  return {
    hsync: (uo >> 7) & 1,
    vsync: (uo >> 3) & 1,
    r: ((uo & 0b0000_0001) << 1) | ((uo >> 4) & 1),
    g: (uo & 0b0000_0010) | ((uo >> 5) & 1),
    b: ((uo >> 1) & 0b10) | ((uo >> 6) & 1),
  };
}

export function encodeTinyVGA(p: VgaPins): number {
  return (
    (p.hsync << 7) |
    ((p.b & 1) << 6) |
    ((p.g & 1) << 5) |
    ((p.r & 1) << 4) |
    (p.vsync << 3) |
    ((p.b >> 1) << 2) |
    ((p.g >> 1) << 1) |
    (p.r >> 1)
  );
}

export const UO_OUT_PIN_NAMES = ['R1', 'G1', 'B1', 'VSYNC', 'R0', 'G0', 'B0', 'HSYNC'];

export interface VgaTiming {
  hVisible: number;
  vVisible: number;
  hTotal: number;
  vTotal: number;
  captureOffsetX: number;
  captureOffsetY: number;
}

export const VGA_640x480: VgaTiming = {
  hVisible: 640,
  vVisible: 480,
  hTotal: 800,
  vTotal: 525,
  captureOffsetX: 47,
  captureOffsetY: 32,
};
