import { useCallback, useEffect, useState } from "react";
import { ArtViewer } from "./components/art-viewer/ArtViewer";
import { LayoutSection } from "./components/chip-viewer/LayoutSection";
import { SiliconSection } from "./components/chip-viewer/SiliconSection";
// import { ProcessJournal } from "./components/engineering-process/ProcessJournal";
import { MathSection } from "./components/math/MathSection";
import { NavBar } from "./components/navigation/NavBar";
import { VerilogLab } from "./components/verilog-lab/VerilogLab";
import { Footer } from "./components/common/Footer";

export function App() {
  const [presenting, setPresenting] = useState(false);
  const toggle = useCallback(() => setPresenting((p) => !p), []);

  useEffect(() => {
    document.body.classList.toggle("presenting", presenting);
  }, [presenting]);

  return (
    <>
      <a className="visually-hidden" href="#experience">
        Skip to artwork
      </a>
      <NavBar presenting={presenting} onTogglePresenting={toggle} />
      <main>
        <ArtViewer />
        <LayoutSection />
        <MathSection />
        <VerilogLab />
        <SiliconSection />
        {/* <ProcessJournal presenting={presenting} /> */}
      </main>
      <Footer />
    </>
  );
}
