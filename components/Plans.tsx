import Reveal from "./Reveal";

const PLANS = [
  { tag: "INDIVIDUALS", name: "Personal", who: "For people with disabilities", price: "Free", note: "Premium €9–15 / month" },
  { tag: "EDUCATION", name: "Institutional license", who: "Schools and universities", price: "€99–299", note: "per device / year" },
  { tag: "ENTERPRISE & PUBLIC SECTOR", name: "Enterprise plan", who: "Companies and governments", price: "€5–15k+", note: "per year, custom" },
  { tag: "OEM PARTNERS", name: "Hardware partner", who: "Computer manufacturers & integrators", price: "Let’s talk", note: "Bundled with your machines" },
];

export default function Plans() {
  return (
    <Reveal
      as="section"
      id="plans"
      aria-labelledby="plans-title"
      className="flex w-full flex-col items-center gap-10 bg-paper px-4 pb-24 md:gap-14 md:px-10 md:pb-[120px]"
    >
      <h2
        id="plans-title"
        data-reveal
        className="text-center text-[32px] leading-[38px] tracking-[-0.03em] text-ink md:text-[52px] md:leading-[56px]"
      >
        From the law to the real world.
        <br />
        Proof the machine actually works.
      </h2>

      <div className="flex w-full max-w-[1360px] flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 basis-0 flex-col gap-4">
          <article
            data-reveal
            className="flex min-h-[420px] shrink-0 flex-col justify-between gap-10 rounded-[12px] bg-forest p-7 md:p-9"
          >
            <div className="flex">
              <span className="rounded-[6px] bg-[#72CE7B29] px-2.5 py-[5px] font-mono text-[11px] leading-[14px] tracking-[0.08em] text-signal">
                COMPLIANCE
              </span>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-[28px] leading-[32px] tracking-[-0.025em] text-white md:text-[36px] md:leading-[40px]">
                Built for the European Accessibility Act.
              </h3>
              <p className="max-w-[520px] text-[16px] leading-[24px] text-[#B9D8BE]">
                Usage logs and accessibility reports show each machine is fully operable without sight or touch. We
                track the EAA, national laws like Spain’s Ley 11/2023, and alert you when they change. Not a legal
                certification — concrete proof of real usability.
              </p>
            </div>
          </article>
          <article data-reveal className="flex flex-col gap-5 rounded-[12px] bg-mist p-7 md:p-9">
            <div className="flex">
              <span className="rounded-[6px] bg-white px-2.5 py-[5px] font-mono text-[11px] leading-[14px] tracking-[0.08em] text-muted">
                IMPACT
              </span>
            </div>
            <p className="text-[22px] leading-[29px] tracking-[-0.015em] text-ink md:text-[24px] md:leading-[31px]">
              Every machine running VoxLayer is one more place a disabled person can study, work and take part fully.
            </p>
            <p className="font-mono text-[12px] leading-4 tracking-[0.04em] text-muted">SDG 10.2 · SDG 8.5 · SDG 4</p>
          </article>
        </div>

        <ul className="flex flex-1 basis-0 flex-col gap-4" aria-label="Plans">
          {PLANS.map((p) => (
            <li
              key={p.tag}
              data-reveal
              className="flex grow flex-wrap items-end justify-between gap-4 rounded-[12px] bg-mist px-7 py-7 md:px-9 md:py-8"
            >
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[11px] leading-[14px] tracking-[0.08em] text-muted">{p.tag}</p>
                <h3 className="text-[24px] leading-[30px] tracking-[-0.015em] text-ink">{p.name}</h3>
                <p className="text-[14px] leading-[18px] text-muted">{p.who}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-[32px] leading-[40px] tracking-[-0.03em] text-ink">{p.price}</p>
                <p className="text-[14px] leading-[18px] text-muted">{p.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}
