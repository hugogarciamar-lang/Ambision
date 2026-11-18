import SmoothScroll from "@/components/SmoothScroll";
import Nav from "@/components/Nav";
import Hero from "@/components/hero/Hero";
import Story from "@/components/story/Story";
import Stat from "@/components/Stat";
import Coverage from "@/components/coverage/Coverage";
import Audiences from "@/components/Audiences";
import HowItWorks from "@/components/HowItWorks";
import Plans from "@/components/Plans";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Nav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Story />
        <Stat />
        <Coverage />
        <Audiences />
        <HowItWorks />
        <Plans />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
