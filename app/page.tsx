import ClonedSite from "./components/cloned-site";
import IntakePopup from "./components/intake-popup";

export default function Home() {
  return (
    <>
      <ClonedSite src="/clone.html" title="Hiller Comerford Injury & Disability Law" />
      <IntakePopup />
    </>
  );
}
