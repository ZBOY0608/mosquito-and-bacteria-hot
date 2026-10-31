// A paper's abstract, shown as the page's body: normally whole, folded behind a fade when it runs long,
// so a 600-word structured abstract does not push the figures and the rest of the page out of reach.
// The fold is client-side only; without JavaScript the text is simply all there.
import { useState } from "react";
import { ArticleBody } from "./ArticleBody";

export function AbstractBody({ html, long }: { html: string; long: boolean }) {
  const [open, setOpen] = useState(false);
  if (!long) return <ArticleBody html={html} />;
  return (
    <>
      <div className={open ? "" : "relative max-h-[30rem] overflow-hidden"}>
        <ArticleBody html={html} />
        {!open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface to-transparent" aria-hidden="true" />}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 text-[12.5px] font-medium text-accent underline-offset-2 transition-colors hover:underline"
      >
        {open ? "收起" : "展开全文"}
      </button>
    </>
  );
}
