type Word = { text: string; color: string };

/**
 * Splits text into word spans for scroll-scrubbed reveals.
 * Each word has its real text in its final colour (what screen readers and the
 * static/reduced-motion page get) and a decorative dimmed copy drawn with a
 * pseudo-element on top. The colour change is a cross-fade between the two, so
 * the animation only touches opacity and transform.
 */
export default function ScrubWords({ words, dim }: { words: Word[]; dim: string }) {
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="sw-word relative inline-block">
            <span className="sw-final" style={{ color: w.color }}>
              {w.text}
            </span>
            <span
              aria-hidden="true"
              className="sw-dim ps-text pointer-events-none absolute top-0 left-0 opacity-0"
              data-text={w.text}
              style={{ color: dim }}
            />
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

export function toWords(text: string, color: string): Word[] {
  return text.split(" ").map((t) => ({ text: t, color }));
}
