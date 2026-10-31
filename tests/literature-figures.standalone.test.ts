// Failure cases behind the figures pass: a paper's figures are dropped because its publisher's address
// pattern was not recognised, a caption loses its mixed-content text, the licence goes missing, or a
// paper without an open-access full text keeps a caption with no image at all.
import "./standalone.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { figuresFromFullText, licenseOf, publisherImageUrls } from "@aihot/backend/content/figures";

const fig = (label: string, caption: string, href: string): string =>
  `<fig position="float" id="F${label}"><label>${label}</label><caption><p>${caption}</p></caption><graphic xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="${href}"/></fig>`;

const article = (figures: string, license = `<license xlink:href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</license>`): string =>
  `<article><front><article-meta><permissions>${license}</permissions></article-meta></front><body><sec>${figures}</sec></body></article>`;

test("frontiers figures keep their caption and get the article's own image address", () => {
  const xml = article(fig("Figure 1", "RNA-seq of mosquitoes <bold>(A)</bold> collected in Yunnan.", "fmicb-17-1788609-g0001.jpg"));
  const [figure] = figuresFromFullText(xml, "10.3389/fmicb.2026.1788609");
  assert.equal(figure?.label, "Figure 1");
  assert.equal(figure?.caption, "RNA-seq of mosquitoes (A) collected in Yunnan.");
  assert.equal(figure?.license, "Creative Commons Attribution 4.0");
  // The deposit names the file g0001, the site serves it as g001.
  assert.deepEqual(figure?.candidates, ["https://www.frontiersin.org/files/Articles/1788609/fmicb-17-1788609-HTML/image_m/fmicb-17-1788609-g001.jpg"]);
});

test("the figure number comes from its position, not from the deposit's file name", () => {
  const xml = article(fig("Fig 2", "Second figure.", "whatever-name.png"));
  const [figure] = figuresFromFullText(xml, "10.1371/journal.pntd.0014222");
  assert.deepEqual(figure?.candidates, ["https://journals.plos.org/plosntds/article/figure/image?size=large&id=10.1371/journal.pntd.0014222.g001"]);
});

test("a publisher whose address cannot be built keeps the caption and offers no image", () => {
  const xml = article(fig("Fig 1", "Structure of the protein.", "ao6c03816_0010.webp"));
  const [figure] = figuresFromFullText(xml, "10.1021/acsomega.6c03816");
  assert.deepEqual(figure?.candidates, []);
  assert.equal(figure?.caption, "Structure of the protein.");
  assert.equal(publisherImageUrls(null, "ao6c03816_0010.webp", 1).length, 0);
});

test("a figure without a caption is not a figure, and six is the cap", () => {
  const seven = Array.from({ length: 7 }, (_, i) => fig(`Figure ${i + 1}`, i === 2 ? "" : `Caption ${i + 1}.`, `f-plos-${i}.jpg`)).join("");
  const figures = figuresFromFullText(article(seven), "10.1371/journal.pone.0000001");
  assert.equal(figures.length, 6);
  assert.ok(figures.every((f) => f.caption));
});

test("the licence is read from the Creative Commons address, and its absence stays absent", () => {
  assert.equal(licenseOf(`<license xlink:href="https://creativecommons.org/licenses/by-nc-nd/4.0/">x</license>`), "Creative Commons Attribution-NonCommercial-NoDerivatives 4.0");
  assert.equal(licenseOf(`<permissions><copyright-statement>All rights reserved</copyright-statement></permissions>`), null);
});
