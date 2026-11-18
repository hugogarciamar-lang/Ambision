import Reveal from "./Reveal";

const STEPS = [
  {
    n: "01",
    title: "Install once. The OS stays intact.",
    body: "One-click install on Windows, macOS or Linux. VoxLayer takes over the interface while leaving the underlying system untouched.",
  },
  {
    n: "02",
    title: "Say what you want, not which key.",
    body: "“Open Excel, put the Barcelona shop sales in column A.” Local AI understands intent across browsers, sheets, email, docs, files and code.",
  },
  {
    n: "03",
    title: "Every action has a sound.",
    body: "Distinct tones for success, error, navigation and confirmation, plus a spoken readout of what changed. Optional braille or haptic output.",
  },
];

export default function HowItWorks() {
  return (
    <Reveal
      as="section"
      id="how-it-works"
      aria-labelledby="how-title"
      className="flex w-full flex-col items-center gap-10 bg-paper px-4 pt-6 pb-24 md:gap-12 md:px-10 md:pt-10 md:pb-[140px]"
    >
      <h2
        id="how-title"
        data-reveal
        className="text-center text-[32px] leading-[40px] tracking-[-0.03em] text-ink md:text-[44px] md:leading-[54px]"
      >
        Speak naturally. Hear everything.
      </h2>
      <ol className="flex w-full max-w-[1200px] flex-col gap-4 md:flex-row">
        {STEPS.map((s) => (
          <li key={s.n} data-reveal className="flex flex-1 basis-0 flex-col gap-5 rounded-[12px] bg-mist p-7 md:p-8">
            <span className="font-mono text-[13px] leading-4 text-muted" aria-hidden="true">
              {s.n}
            </span>
            <h3 className="pt-6 text-[24px] leading-[30px] tracking-[-0.02em] text-ink md:pt-12 md:text-[26px] md:leading-[32px]">
              {s.title}
            </h3>
            <p className="text-[15px] leading-[23px] text-muted">{s.body}</p>
            <div className="flex grow items-end pt-3">
              <a href="#plans" className="rounded-sm bg-white px-3.5 py-[9px] text-[13px] leading-4 text-ink hover:bg-line">
                Learn more<span className="sr-only"> about step {s.n}: {s.title}</span>
              </a>
            </div>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
