# GATE_REQUEST

Relay for Grok Bot, then Chief of Staff, then Plato. Public copy. Do not merge until each APPROVE names this PR's exact head.

- Repo: linus10x/autonomy-ladder
- Branch: saas-pages-20261016
- Site: https://autonomy-ladder.io/
- Order: Kunjar, 2026-10-16 12:44 PM CT. Autonomy Ladder unparked. Extend the existing site. Keep going on the trademark.

## What this PR adds

- /product: the live pieces are the in-browser self-score and the six public libraries. No account and no card.
- /pricing: free self-score and open libraries at $0. Builder and Operator are labeled Plan. No paid price and no buy button.
- /docs: A0 to A4 definitions, the diagnostic scoring rule, the six repos and DOIs, FAQ with FAQPage JSON-LD.
- /waitlist: posts to Kit form 9506738, the same action URL as the forms already on the home page and /diagnostic.
- robots.txt, sitemap.xml, llms.txt.
- Organization and WebSite JSON-LD on the home page. SoftwareApplication JSON-LD on /product.
- Nav on the existing pages links to the new pages. The self-score at /diagnostic is unchanged.

Open PR #5 (/assess) and open PR #6 (an earlier llms.txt) are separate. This PR includes its own llms.txt. If both land, keep the file from the later head.

## Claims, and where they come from

- A0 Informational through A4 Production Autonomous, and the one-line definitions: already on index.html and in README.md "Canonical ladder". This PR copies those lines. It does not use the retired rung names (Manual, Constrained-Autonomous, Bounded-Autonomous, Autonomous-with-Sovereign-Veto).
- Six repos and Zenodo DOIs: README.md table, also on the home page.
- Scoring rule: diagnostic/index.html script, tierFromScore. The tier is the lower of the rounded average and one step above the weakest answer, capped at 4.
- Kit form 9506738: the action URL already on index.html and diagnostic/index.html.
- $0 for the self-score and the libraries: those pages have no payment step. career_kit/VERIFIED_FACTS.md in kunjar-hq has no Autonomy Ladder price, so no paid dollar amount is stated.
- "Autonomy Ladder is a common-law mark of Kunjar Bhaduri" is the sentence already in the home page footer. New pages do not add a registration claim.
- No customer, no testimonial, no usage count, no street address. The $750M line and the "25+ years" line already on the home page are not repeated on the new pages.

## Stops

- Do not merge, deploy, or push to main from this request. Main auto-deploys to autonomy-ladder.io.
- Kunjar merges after the gate names the exact head.
