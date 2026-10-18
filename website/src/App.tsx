import { ArtViewer } from "./components/art-viewer/ArtViewer";
import { LayoutSection } from "./components/chip-viewer/LayoutSection";
import { SiliconSection } from "./components/chip-viewer/SiliconSection";
import { MathSection } from "./components/math/MathSection";
import { NavBar } from "./components/navigation/NavBar";
import { VerilogLab } from "./components/verilog-lab/VerilogLab";
import { Footer } from "./components/common/Footer";

export function App() {
  return (
    <>
      <a className="visually-hidden" href="#experience">
        Skip to artwork
      </a>
      <NavBar />
      <main>
        <ArtViewer />
        <LayoutSection />
        <MathSection />
        <VerilogLab />
        <SiliconSection />
      </main>
      <Footer />
    </>
  );
}
