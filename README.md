# autonomy-ladder.io

The static marketing + diagnostic site for the **Autonomy Ladder™** — a
Regulated-Operations AI Governance framework (A0 → A4) for AI agents that have to
hold under audit. One discipline, **six co-equal regulated verticals**, each with
its own examiner, rule cite, and open pattern library:

- **Private Capital** — allocators, alts, family offices, buy-side AI
- **Commercial Real Estate**
- **Financial Services**
- **Banking**
- **Payments**
- **Healthcare Payer**

## The six open-source pattern libraries

These are the governance primitives the diagnostic scores you against — public,
permissively licensed, and DOI-archived on Zenodo.

| Vertical | Repo | Zenodo DOI |
|---|---|---|
| Financial Services | [`linus10x/finserv-agent-audit`](https://github.com/linus10x/finserv-agent-audit) | [10.5281/zenodo.20434570](https://doi.org/10.5281/zenodo.20434570) |
| Commercial Real Estate | [`linus10x/cre-agent-audit`](https://github.com/linus10x/cre-agent-audit) | [10.5281/zenodo.20437081](https://doi.org/10.5281/zenodo.20437081) |
| Healthcare Payer | [`linus10x/payer-agent-audit`](https://github.com/linus10x/payer-agent-audit) | [10.5281/zenodo.20564377](https://doi.org/10.5281/zenodo.20564377) |
| Private Capital | [`linus10x/private-capital-agent-audit`](https://github.com/linus10x/private-capital-agent-audit) | [10.5281/zenodo.20564496](https://doi.org/10.5281/zenodo.20564496) |
| Banking | [`linus10x/banking-agent-audit`](https://github.com/linus10x/banking-agent-audit) | [10.5281/zenodo.20564584](https://doi.org/10.5281/zenodo.20564584) |
| Payments | [`linus10x/payments-agent-audit`](https://github.com/linus10x/payments-agent-audit) | [10.5281/zenodo.20592773](https://doi.org/10.5281/zenodo.20592773) |

## Canonical ladder (source of truth: cre-agent-audit ADR-0004)

| Tier | Name | One-line |
|---|---|---|
| A0 | Informational | Agent reads and recommends. No write authority. |
| A1 | Assisted | Agent drafts. Human approves every write. |
| A2 | Delegated | Agent writes inside a hard envelope; sampled + out-of-envelope review. |
| A3 | Supervised Autonomous | In-scope autonomous writes; non-overridable sovereign veto; live audit ledger. |
| A4 | Production Autonomous | A3 plus inter-agent orchestration and operator-validated escalation. |

## Page inventory

```
index.html             Home: the six co-equal verticals, the ladder, positioning
product/index.html     /product: what is live (self-score, libraries) and what is not
pricing/index.html     /pricing: free tier at $0; Builder and Operator marked Plan
assessment/index.html /assessment: canonical seven-question self-score; /diagnostic and /assess 301 here
libraries/index.html   /libraries: six open libraries and four tools, reference code only
_redirects             301 /diagnostic and /assess to /assessment (Workers static assets, no Worker script)
docs/index.html        /docs: A0 to A4 definitions, scoring rule, library DOIs, FAQ
libraries/<name>/index.html  one page per library and runnable tool, license and DOI from that README
waitlist/index.html    /waitlist: Kit form 9506738, same endpoint as the home form
services/index.html    /services: engagement model, per-vertical rule cites, libraries
whitepaper/index.html  /whitepaper
thank-you.html         /thank-you: post-submit confirmation (noindex)
robots.txt             crawler rules, including AI crawlers, plus the sitemap URL
sitemap.xml
llms.txt
assets/site.css        shared stylesheet for the product, pricing, docs, and waitlist pages
assets/og.png          1200x630 social card (og:image / twitter:image)
assets/og.svg          Editable source for the social card
assets/favicon.svg
_headers               Cloudflare Pages cache + security headers (see note below)
```

No build step. Every page is hand-authored HTML with inline CSS; the diagnostic
scorer is inline vanilla JS. There is no bundler, no framework, no node_modules.

## Deploy

Hosted on **Cloudflare Pages**, Git-connected. **Push to `main` → auto-deploy to
production** (`autonomy-ladder.io`). No build command; the output directory is the
repo root. `autonomy-ladder.com` 301-redirects to `.io`.

Because a push to `main` ships straight to production, validate before pushing:
HTML well-formed (no broken tags), all internal links and the six library links
resolve, and the diagnostic scorer + Kit forms intact. The full site-tests harness
lives in the owner's out-of-tree control-center repo, so in-tree pre-edit
validation is an HTML lint + a link check.

To regenerate the og card after editing `assets/og.svg`:

```bash
python3 -m pip install cairosvg --break-system-packages
python3 -c "import cairosvg; cairosvg.svg2png(url='assets/og.svg', write_to='assets/og.png', output_width=1200, output_height=630)"
```

## `_headers` / CSP note — do not tighten `script-src`

The `_headers` file sets the Content-Security-Policy for the whole site. The
`script-src` directive **must keep `'unsafe-inline'`**: the Cloudflare edge
challenge / Web-Analytics beacon is injected inline at the edge and is **not
hash-pinnable**, so a stricter `script-src` (hash- or nonce-only) silently breaks
the beacon and the challenge path. Leave `'unsafe-inline'` in place.
