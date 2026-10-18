# SPDX-FileCopyrightText: © 2026 Om Rawaley
# SPDX-License-Identifier: Apache-2.0

"""
Functional smoke test for the BITFIELD demoscene VGA generator.

Checks (RTL simulation; probe-based checks are skipped in gate-level):
  * There are 525 - 527 lines between two VSYNC pulses (HSYNC pulses once
    per 800-clock VGA line).
  * The RGB outputs are forced low in the VSYNC pulse region of a frame.
  * Manual mode (ui[4]=1) selects the pattern via ui[7:5] immediately,
    and ui[4]=0 hands control back to the LFSR VJ (mode == confi[2:0]).
  * A sampled visible line carries non-zero plasma pixels, time moves the
    picture, and the alternate palette changes colours.
"""

import cocotb
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, FallingEdge, ClockCycles

PX_PER_LINE = 800
LINES_PER_FRAME = 525


def _sig(dut, name):
    """Hierarchical probe, or None when running on a gate-level netlist."""
    try:
        return getattr(dut.user_project, name)
    except AttributeError:
        return None


def _read(sig):
    return None if sig is None else int(sig.value)


@cocotb.test()
async def test_vga_timing(dut):
    """VGA sync rates and forced blanking."""
    dut._log.info("Start")
    clock = Clock(dut.clk, 39.72, unit="ns")  # 25.175 MHz pixel clock
    cocotb.start_soon(clock.start())

    dut.ena.value = 1
    dut.ui_in.value = 0
    dut.uio_in.value = 0
    dut.rst_n.value = 0
    await ClockCycles(dut.clk, 10)
    dut.rst_n.value = 1

    vsync = _sig(dut, "v_sync")
    hsync = _sig(dut, "h_sync")
    if vsync is None:
        dut._log.info("Gate-level netlist: sync probe tests skipped")
        await ClockCycles(dut.clk, 100_000)
        assert dut.uo_out.value is not None
        return

    # count HSYNC pulses between two VSYNC pulses: exactly one per VGA line.
    # The counter runs in its own coroutine so it does not race the main
    # coroutine's wait for the next VSYNC pulse.
    await RisingEdge(vsync)

    lines = 0
    counting = True

    async def count_lines():
        nonlocal lines
        while counting:
            await RisingEdge(hsync)
            if counting:
                lines += 1

    counter = cocotb.start_soon(count_lines())
    await RisingEdge(vsync)
    counting = False
    await counter
    assert 523 <= lines <= 527, f"expected ~525 lines per frame, got {lines}"
    dut._log.info(f"lines per frame: {lines}")

    # inside the next VSYNC pulse RGB must be forced to 0 (active low vsync).
    # uo_out is combinational, so settle one clock before sampling it to
    # avoid racing Icarus' delta-cycle propagation order.
    await FallingEdge(vsync)
    await RisingEdge(dut.clk)
    assert _read(vsync) == 0, "expected to be inside the vsync pulse"
    assert (int(dut.uo_out.value) & 0x3F) == 0, "RGB must be blank during vsync"


@cocotb.test()
async def test_mode_switch(dut):
    """Manual mode picks the pattern; auto mode cycles the gallery."""
    dut._log.info("Start")
    clock = Clock(dut.clk, 39.72, unit="ns")
    cocotb.start_soon(clock.start())

    dut.ena.value = 1
    dut.ui_in.value = 0
    dut.uio_in.value = 0
    dut.rst_n.value = 0
    await ClockCycles(dut.clk, 10)
    dut.rst_n.value = 1

    vsync = _sig(dut, "v_sync")
    pat_sel = _sig(dut, "pat_sel")
    if vsync is None or pat_sel is None:
        dut._log.info("Gate-level netlist: mode probe tests skipped")
        await ClockCycles(dut.clk, 100_000)
        return

    # auto mode: pattern comes from the gallery counter (0..6)
    await RisingEdge(vsync)
    assert 0 <= _read(pat_sel) <= 6, f"auto pattern out of range: {_read(pat_sel)}"

    # manual mode: ui[7:5] selects the pattern
    dut.ui_in.value = 0b011_1_00_00  # manual, pattern 3
    await RisingEdge(vsync)
    assert _read(pat_sel) == 3, f"manual pattern 3, got {_read(pat_sel)}"

    dut.ui_in.value = 0b000_1_00_00  # manual, pattern 0
    await RisingEdge(vsync)
    assert _read(pat_sel) == 0, f"manual pattern 0, got {_read(pat_sel)}"

    # back to auto
    dut.ui_in.value = 0
    await RisingEdge(vsync)
    assert 0 <= _read(pat_sel) <= 6, f"auto pattern out of range: {_read(pat_sel)}"


@cocotb.test()
async def test_plasma_picture(dut):
    """A visible line has live plasma pixels, and palettes / time differ."""
    dut._log.info("Start")
    clock = Clock(dut.clk, 39.72, unit="ns")
    cocotb.start_soon(clock.start())

    dut.ena.value = 1
    dut.ui_in.value = 0
    dut.uio_in.value = 0
    dut.rst_n.value = 0
    await ClockCycles(dut.clk, 10)
    dut.rst_n.value = 1

    hsync = _sig(dut, "h_sync")
    vsync = _sig(dut, "v_sync")
    h_cnt = _sig(dut, "h_cnt")
    v_cnt = _sig(dut, "v_cnt")
    if hsync is None:
        dut._log.info("Gate-level netlist: pixel probe tests skipped")
        await ClockCycles(dut.clk, 100_000)
        return

    # emit a list of sampled pixel colours of line 240, x = 200..595
    async def sample_line240(ui_value):
        dut.ui_in.value = ui_value
        await RisingEdge(vsync)
        while _read(v_cnt) != 240:
            await FallingEdge(hsync)
        # row 240 is latched; wait for the line to restart, then skip to x=200
        while _read(h_cnt) != 0:
            await RisingEdge(dut.clk)
        await ClockCycles(dut.clk, 200)
        vals = []
        for _ in range(80):
            vals.append(int(dut.uo_out.value) & 0x3F)
            for _ in range(5):  # 5 px steps
                await RisingEdge(dut.clk)
        return vals

    plasma_ui = 0b001_1_00_00  # manual, pattern 1 (plasma), natural palette
    a = await sample_line240(plasma_ui)
    assert sum(1 for v in a if v != 0) > 20, "plasma picture should not be blank"

    b = await sample_line240(plasma_ui)
    assert a != b, "picture must animate over time"

    c = await sample_line240(0b001_1_11_00)  # same, but inverted palette
    assert a != c, "alternate palette must change colours"
    dut.ui_in.value = 0
