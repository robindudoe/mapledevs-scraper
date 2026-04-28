# MapleDevs Traffic System

This repo now generates traffic assets from the existing approved jobs data.

## Main command

```bash
npm run traffic
```

On Windows PowerShell, use `npm.cmd run traffic` if script execution policy blocks `npm`.

Outputs:

- SEO landing pages for Canadian, remote, entry-level, design, Unity, Unreal, artist, programming, and studio-hiring searches.
- Weekly pages for new jobs, remote jobs, and entry-level jobs this week.
- Static job pages with JobPosting structured data when the listing has the required fields.
- `sitemap.xml`, `robots.txt`, `rss.xml`, `feed.xml`, IndexNow key/payload files.
- Local review files in `traffic/`:
  - `traffic/social-snippets.md`
  - `traffic/newsletter-draft.md`
  - `traffic/dashboard.html`
  - `traffic/dashboard.json`

## Review workflow

1. Run `npm run traffic`.
2. Open `traffic/dashboard.html`.
3. Review `traffic/social-snippets.md` before posting anywhere.
4. Open `traffic/newsletter-draft.html` or copy from `traffic/newsletter-draft.md` into Brevo.

The system does not auto-post to LinkedIn, Reddit, Discord, or X. It only creates draft copy for manual review.

## IndexNow

The build creates:

- `mapledevs-indexnow-20260428.txt`
- `indexnow-urls.json`

Run a dry check with:

```bash
node indexnow-submit.js --dry-run
```

Submit after deploy with:

```bash
npm run indexnow
```

GitHub Actions also runs the IndexNow submit step after the SEO build.
