import type { HdlModule } from './verilog-adapter';
import { registerHdlBackend } from './verilog-adapter';
import { compileVerilator } from '../vendor/vga-playground/verilator/compile';
import { HDLModuleWASM } from '../vendor/vga-playground/sim/hdlwasm';

registerHdlBackend({
  name: 'Verilator-WASM + hdlwasm (vendored from the Tiny Tapeout VGA playground)',
  license: 'ISC (Verilator WASM) · GPL-3.0 (8bitworkshop simulation runtime)',
  async create(sources: Record<string, string>, topModule: string): Promise<HdlModule> {
    const res = await compileVerilator({ topModule, sources });
    if (!res.output) {
      const errors = res.errors
        .filter((e) => e.type === 'error')
        .map((e) => `${e.file}:${e.line}:${e.column} ${e.message}`)
        .join('\n');
      throw new Error(errors || 'Verilator compilation failed.');
    }
    const constpool = res.output.modules['@CONST-POOL@'] || res.output.modules['__Vconst'] || null;
    const mod = new HDLModuleWASM(res.output.modules['TOP'], constpool);
    await mod.init();
    return mod as unknown as HdlModule;
  },
});
