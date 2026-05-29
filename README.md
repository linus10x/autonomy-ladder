# autonomy-ladder.io

Marketing site for the **Autonomy Ladder™** — a Regulated-Operations AI Governance
framework (A0 → A4) for AI agents that have to hold under audit. One discipline,
two verticals: Private Capital and Commercial Real Estate.

Companion to the open-source pattern repos:
- [`linus10x/finserv-agent-audit`](https://github.com/linus10x/finserv-agent-audit)
- [`linus10x/cre-agent-audit`](https://github.com/linus10x/cre-agent-audit)

## Canonical ladder (source of truth: cre-agent-audit ADR-0004)

| Tier | Name | One-line |
|---|---|---|
| A0 | Informational | Agent reads and recommends. No write authority. |
| A1 | Assisted | Agent drafts. Human approves every write. |
| A2 | Delegated | Agent writes inside a hard envelope; sampled + out-of-envelope review. |
| A3 | Supervised Autonomous | In-scope autonomous writes; non-overridable sovereign veto; live audit ledger. |
| A4 | Production Autonomous | A3 plus inter-agent orchestration and operator-validated escalation. |

## Structure

```
index.html        Single-page static site (inline CSS, no build step)
assets/og.png     1200×630 social card (og:image / twitter:image)
assets/og.svg     Editable source for the card
assets/favicon.svg
_headers          Cloudflare Pages cache + security headers
```

## Deploy

Hosted on **Cloudflare Pages** (Git-connected). Push to `main` → auto-deploy.
No build command; output directory is the repo root. Custom domain: `autonomy-ladder.io`.

To regenerate the og card after editing `assets/og.svg`:
```bash
python3 -m pip install cairosvg --break-system-packages
python3 -c "import cairosvg; cairosvg.svg2png(url='assets/og.svg', write_to='assets/og.png', output_width=1200, output_height=630)"
```
