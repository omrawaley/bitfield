/*
 * Standalone render testbench (not used by cocotb CI).
 *
 * Captures VGA frames straight from the design and writes PPM images of
 * frames 4, 8, ... 32 (one every 4 frames) so the pattern maths can be
 * inspected on a workstation.
 *
 *   iverilog -o /tmp/opencode/tb_render <src_dir files> test/tb_render.v
 *   /tmp/opencode/tb_render
 */

`timescale 1ns/1ps
`default_nettype none

module tb_render;

  localparam CLK_HALF = 19.86;  // pixel clock ~25.175 MHz (39.72 ns period)

  reg        clk    = 1'b0;
  reg        rst_n  = 1'b0;
  reg        ena    = 1'b1;
  reg [7:0]  ui_in  = 8'd0;   // palette A, rings on, slow scroll
  reg [7:0]  uio_in = 8'd0;
  wire [7:0] uo_out;
  wire [7:0] uio_out;
  wire [7:0] uio_oe;

  tt_um_omrawaley_bitfield dut (
    .ui_in  (ui_in),
    .uo_out (uo_out),
    .uio_in (uio_in),
    .uio_out(uio_out),
    .uio_oe (uio_oe),
    .ena    (ena),
    .clk    (clk),
    .rst_n  (rst_n)
  );

  always #(CLK_HALF) clk = ~clk;

  wire frame_tick = (dut.h_cnt == 10'd799) & (dut.v_cnt == 10'd524);

  reg [5:0] px_mem [0:307199];  // 640x480 frame buffer, 2-bit RGB
  reg       capturing = 1'b0;
  integer   frame = 0;

  // Each captured frame is dumped as soon as it finishes, so frame_4.ppm
  // really holds frame 4, frame_8.ppm frame 8, etc. px_mem stores the
  // Tiny VGA PMOD channels as {r[1:0], g[1:0], b[1:0]} (MSB-first), which
  // means gathering the pins in the capture below.
  task dump_frame(input integer fnum);
    integer     d_fd, d_y, d_x, d_lvl;
    reg [127:0] d_name;
    begin
      $sformat(d_name, "frame_%0d.ppm", fnum);
      d_fd = $fopen(d_name, "w");
      if (d_fd == 0) begin
        $display("ERROR: cannot open %0s", d_name);
        $finish;
      end
      $fdisplay(d_fd, "P3 640 480 255");
      for (d_y = 0; d_y < 480; d_y = d_y + 1) begin
        for (d_x = 0; d_x < 640; d_x = d_x + 1) begin
          d_lvl = px_mem[(d_y * 640) + d_x];
          $fdisplay(d_fd, "%0d %0d %0d",
                    85 * (d_lvl >> 4),            // R1=uo[0]  R0=uo[4]
                    85 * ((d_lvl >> 2) & 2'b11),  // G1=uo[1]  G0=uo[5]
                    85 * (d_lvl & 2'b11));        // B1=uo[2]  B0=uo[6]
        end
      end
      $fclose(d_fd);
      $display("dumped frame_%0d.ppm (t=%0t)", fnum, $time);
    end
  endtask

  // capture one frame every 4 frames (frame 4, 8, ..., 32)
  always @(posedge clk) begin
    if (frame_tick) begin
      if (capturing) begin
        dump_frame(frame);
        if (frame >= 32) $finish;
      end
      frame <= frame + 1;
      capturing <= ((frame % 4) == 3) && (frame < 33);
    end else if (capturing && dut.active) begin
      px_mem[dut.v_cnt * 640 + dut.h_cnt]
          <= {uo_out[0], uo_out[4],  // r_pix = {R1, R0}
              uo_out[1], uo_out[5],  // g_pix = {G1, G0}
              uo_out[2], uo_out[6]}; // b_pix = {B1, B0}
    end
  end

  initial begin
    #(CLK_HALF * 2);
    rst_n = 1'b1;
  end

endmodule
