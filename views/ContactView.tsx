import { ContactPanel } from "@/components/ContactPanel";
import { Here } from "@/components/Here";
import { Footer } from "@/components/Footer";
import { TLink } from "@/components/Transition";

const d = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as React.CSSProperties;

export function ContactView() {
  return (
    <main className="page" data-kind="contact">
      <section className="wrap d-hero">
        <div className="d-copy">
          <p className="mono rise">
            <TLink href="/">Home</TLink> / Contact
          </p>
          <h1 className="rise" style={d(80)}>
            <span className="name">Say hello</span>
          </h1>
          <p className="lede rise" style={d(160)}>
            Email is the best way to reach me. Copy the address, or write a note here and it will open in your own mail app.
          </p>
          <div className="rise" style={d(220)}>
            <Here brief />
          </div>
        </div>
      </section>

      <ContactPanel />

      <Footer />
    </main>
  );
}
