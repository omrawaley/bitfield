/*
 * BITFIELD — an algorithmic VGA demoscene generator for Tiny Tapeout.
 *
 * Hardware port of the BITFIELD website's UI demo patterns: every pixel
 * is computed live from (x, y, t) by one of seven bitwise/arithmetic
 * formulas, coloured through a small colour-map palette. The chip cycles
 * through the pattern gallery (each with the same default shift amount
 * and colour map as the website), and t advances once per frame, so the
 * picture is always moving.
 *
 *   lattice       ((x >> s) ^ (y >> s)) + t
 *   rings         (d2 >> (s + 4)) + t                        d2 = |x-320|^2 + |y-240|^2
 *   hyperbola     ((x * y) >> (s + 6)) + t
 *   interference  ((d2 >> 8) + t) ^ ((x ^ y) >> s)
 *   sierpinski    ((x >> s) & ((y + t) >> s)) == 0 ? (x ^ y) >> 2 : 0
 *   weave         ((x + y + t) >> s) ^ ((x - y - t) >> s)
 *   tartan        (((x >> s) | (y >> s)) ^ ((x >> (s+2)) & (y >> (s+2)))) + t
 *
 * Colour maps: direct / high bits / split / inverted.
 * Manual mode (ui[4]=1): ui[7:5]=pattern 0..6, ui[3:2]=colour map,
 * ui[1:0]=shift amount. ui[4]=0 runs the auto gallery.
 *
 * VGA 640x480 @ 60 Hz: pixel clock is the tile clock (25.175 MHz).
 * Pinout: Tiny VGA PMOD / Tiny Tapeout web VGA playground:
 *   uo[0]=R1 uo[1]=G1 uo[2]=B1 uo[3]=VSYNC
 *   uo[4]=R0 uo[5]=G0 uo[6]=B0 uo[7]=HSYNC   (syncs active low)
 *
 * Copyright (c) 2024 Om Rawaley
 * SPDX-License-Identifier: Apache-2.0
 */

`default_nettype none

module tt_um_omrawaley_bitfield (
    input  wire [7:0] ui_in,    // Dedicated inputs
    output wire [7:0] uo_out,   // Dedicated outputs
    input  wire [7:0] uio_in,   // IOs: Input path
    output wire [7:0] uio_out,  // IOs: Output path
    output wire [7:0] uio_oe,   // IOs: Enable path (active high: 0=input, 1=output)
    input  wire       ena,      // always 1 when the design is powered
    input  wire       clk,      // pixel clock (25.175 MHz for 640x480@60)
    input  wire       rst_n     // reset_n - low to reset
);

  // ------------------------------------------------------------------
  // VGA 640x480 @ 60 Hz timing generator
  //   H: 640 visible / 16 front porch / 96 sync / 48 back porch
  //   V: 480 visible / 10 front porch / 2 sync  / 33 back porch
  //   Sync polarity: active low, generated combinationally.
  // ------------------------------------------------------------------
  reg [9:0] h_cnt, v_cnt;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      h_cnt <= 10'd0;
      v_cnt <= 10'd0;
    end else if (h_cnt == 10'd799) begin
      h_cnt <= 10'd0;
      v_cnt <= (v_cnt == 10'd524) ? 10'd0 : v_cnt + 10'd1;
    end else begin
      h_cnt <= h_cnt + 10'd1;
    end
  end

  wire active = (h_cnt < 10'd640) & (v_cnt < 10'd480);

  wire h_sync = !((h_cnt - 10'd656) < 10'd96);
  wire v_sync = !((v_cnt - 10'd490) < 10'd2);

  /* verilator lint_off WIDTH */

  reg vsync_d;
  wire vsync_edge = (vsync_d == 1'b1) & (v_sync == 1'b0);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) vsync_d <= 1'b1;
    else        vsync_d <= v_sync;
  end

  // ------------------------------------------------------------------
  // Show controller: advance t every frame; cycle the pattern gallery
  // every 60 frames (~1 s). ui[4]=1 hands control to the DIP switches.
  // ------------------------------------------------------------------
  reg [5:0] frame_count;
  reg [2:0] pat;
  reg [7:0] t;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      frame_count <= 6'd0;
      pat <= 3'd0;
      t <= 8'd0;
    end else if (vsync_edge) begin
      t <= t + 8'd1;
      if (frame_count == 6'd59) begin
        frame_count <= 6'd0;
        pat <= (pat == 3'd6) ? 3'd0 : pat + 3'd1;
      end else begin
        frame_count <= frame_count + 6'd1;
      end
    end
  end

  wire manual = ui_in[4];
  wire [2:0] pat_sel = manual ? ((ui_in[7:5] == 3'd7) ? 3'd0 : ui_in[7:5]) : pat;

  // Website default shift amount / colour map per pattern
  reg [1:0] d_s, d_map;
  always @* begin
    case (pat_sel)
      3'd0: begin d_s = 2'd2; d_map = 2'd1; end  // lattice:      s=2, high
      3'd1: begin d_s = 2'd0; d_map = 2'd1; end  // rings:        s=0, high
      3'd2: begin d_s = 2'd0; d_map = 2'd1; end  // hyperbola:    s=0, high
      3'd3: begin d_s = 2'd2; d_map = 2'd1; end  // interference: s=2, high
      3'd4: begin d_s = 2'd1; d_map = 2'd0; end  // sierpinski:   s=1, direct
      3'd5: begin d_s = 2'd3; d_map = 2'd2; end  // weave:        s=3, split
      default: begin d_s = 2'd1; d_map = 2'd2; end  // tartan:    s=1, split
    endcase
  end

  wire [1:0] s_sel   = manual ? ui_in[1:0] : d_s;
  wire [1:0] map_sel = manual ? ui_in[3:2] : d_map;

  wire [2:0] s4 = {1'b0, s_sel} + 3'd4;  // rings shift:    4..7
  wire [3:0] s6 = {2'b0, s_sel} + 4'd6;  // hyperbola shift: 6..9
  wire [2:0] s2 = {1'b0, s_sel} + 3'd2;  // tartan coarse shift: 2..5

  // ------------------------------------------------------------------
  // Render pipeline (same modular arithmetic as the website evaluator).
  // ------------------------------------------------------------------
  wire [9:0] X = h_cnt;
  wire [9:0] Y = v_cnt;

  wire [9:0] ax = (X > 10'd319) ? (X - 10'd320) : (10'd320 - X);
  wire [9:0] ay = (Y > 10'd239) ? (Y - 10'd240) : (10'd240 - Y);
  wire [17:0] d2 = ax * ax + ay * ay;        // <= 160000
  wire [19:0] prod = X * Y;                  // <= 639 * 479

  wire signed [11:0] w_a = $signed({2'b00, X}) + $signed({2'b00, Y}) + $signed({4'b0000, t});
  wire signed [11:0] w_b = $signed({2'b00, X}) - $signed({2'b00, Y}) - $signed({4'b0000, t});

  reg [7:0] v;
  always @* begin
    case (pat_sel)
      3'd0: v = ((X >> s_sel) ^ (Y >> s_sel)) + t;                                   // lattice
      3'd1: v = (d2 >> s4) + t;                                                      // rings
      3'd2: v = (prod >> s6) + t;                                                    // hyperbola
      3'd3: v = ((d2[17:8]) + t) ^ ((X ^ Y) >> s_sel);                               // interference
      3'd4: v = ((X >> s_sel) & ((Y + t) >> s_sel)) == 0 ? ((X ^ Y) >> 2) : 8'd0;    // sierpinski
      3'd5: v = (w_a >>> s_sel) ^ (w_b >>> s_sel);                                   // weave
      default: v = (((X >> s_sel) | (Y >> s_sel)) ^ ((X >> s2) & (Y >> s2))) + t;    // tartan
    endcase
  end

  // ------------------------------------------------------------------
  // Colour maps (2-bit RGB): direct / high / split / inverted
  // ------------------------------------------------------------------
  reg [1:0] r_pix, g_pix, b_pix;
  always @* begin
    case (map_sel)
      2'd0: begin r_pix = v[5:4]; g_pix = v[3:2]; b_pix = v[1:0]; end                 // direct
      2'd1: begin r_pix = v[7:6]; g_pix = v[6:5]; b_pix = v[5:4]; end                 // high
      2'd2: begin r_pix = v[7:6]; g_pix = v[5:4] ^ v[7:6]; b_pix = v[3:2]; end        // split
      default: begin r_pix = ~v[5:4]; g_pix = ~v[3:2]; b_pix = ~v[1:0]; end           // inverted
    endcase
  end

  /* verilator lint_on WIDTH */

  // Tiny VGA PMOD (uses a resistor ladder to convert these digital values to analog)
  assign uo_out = {h_sync,
                   active ? b_pix[0] : 1'b0,
                   active ? g_pix[0] : 1'b0,
                   active ? r_pix[0] : 1'b0,
                   v_sync,
                   active ? b_pix[1] : 1'b0,
                   active ? g_pix[1] : 1'b0,
                   active ? r_pix[1] : 1'b0};

  assign uio_out = 8'd0;
  assign uio_oe  = 8'd0;

  wire _unused = &{ena, uio_in, 1'b0};

endmodule
