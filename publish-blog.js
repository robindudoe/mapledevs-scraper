const fs = require('fs-extra');
const path = require('path');

const BANNED_TERMS = ['Swarm', 'AI-Powered', 'Intelligence'];
const BLOG_DIR = path.join(__dirname, 'blog');
const DRAFTS_DIR = path.join(__dirname, 'blog-drafts');
const TEMPLATE_PATH = path.join(__dirname, 'blog-template.html');

/**
 * Validates a draft object against strict editorial rules.
 */
function validateDraft(draft) {
    if (draft.status !== 'approved') {
        throw new Error(`DRAFT_NOT_APPROVED: Status is '${draft.status}'. Change to 'approved' to publish.`);
    }

    if (!draft.slug || /[^a-z0-9-]/.test(draft.slug)) {
        throw new Error(`INVALID_SLUG: Slug must be lowercase letters, numbers, and hyphens only. Got: ${draft.slug}`);
    }

    if (draft.html_body.includes('```') || draft.html_body.includes('# ')) {
        throw new Error('MARKDOWN_DETECTED: html_body must be clean HTML, not Markdown.');
    }

    if (draft.html_body.includes('<script')) {
        throw new Error('SECURITY_VIOLATION: Script tags are forbidden in blog bodies.');
    }

    for (const term of BANNED_TERMS) {
        const regex = new RegExp(term, 'gi');
        if (regex.test(draft.html_body) || regex.test(draft.title)) {
            throw new Error(`BANNED_BRANDING: Found '${term}'. Please use 'MapleDevs Editorial' instead.`);
        }
    }
}

/**
 * Main Publisher Function
 */
async function publish(draftFilename) {
    const draftPath = path.join(DRAFTS_DIR, draftFilename);
    if (!await fs.pathExists(draftPath)) {
        throw new Error(`FILE_NOT_FOUND: ${draftFilename} not found in blog-drafts/`);
    }

    const draft = await fs.readJson(draftPath);
    console.log(`[Publisher] Validating: ${draft.title}...`);
    validateDraft(draft);

    const date = draft.approved_at 
        ? new Date(draft.approved_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // 1. Read Template
    let html = await fs.readFile(TEMPLATE_PATH, 'utf-8');
    
    // 2. Build Sources HTML
    let sourcesHtml = '';
    if (draft.sources && draft.sources.length > 0) {
        sourcesHtml = `<section class="sources"><h3>Sources</h3><ul>`;
        for (const s of draft.sources) {
            sourcesHtml += `<li><a href="${s.url}" target="_blank">${s.title}</a>: ${s.used_for}</li>`;
        }
        sourcesHtml += `</ul></section>`;
    }

    // 3. Inject Content
    html = html.replace(/{{TITLE}}/g, draft.title);
    html = html.replace(/{{META_DESCRIPTION}}/g, draft.meta_description);
    html = html.replace(/{{DATE}}/g, date);
    html = html.replace(/{{CONTENT}}/g, draft.html_body + sourcesHtml);

    // 4. Write Final File
    const finalPath = path.join(BLOG_DIR, `${draft.slug}.html`);
    await fs.writeFile(finalPath, html);
    console.log(`[Publisher] Created: /blog/${draft.slug}.html`);

    // 5. Update Blog Archive (blog/index.html)
    const archivePath = path.join(BLOG_DIR, 'index.html');
    if (await fs.pathExists(archivePath)) {
        let archiveContent = await fs.readFile(archivePath, 'utf-8');
        const newCard = `<!-- ═══════ BLOG POSTS START ═══════ -->
            <a href="/blog/${draft.slug}.html" class="blog-card">
                <span class="date">${date}</span>
                <h2>${draft.title}</h2>
                <p>${draft.meta_description}</p>
            </a>`;
        
        if (archiveContent.includes('<!-- ═══════ BLOG POSTS START ═══════ -->')) {
            archiveContent = archiveContent.replace('<!-- ═══════ BLOG POSTS START ═══════ -->', newCard);
            await fs.writeFile(archivePath, archiveContent);
            console.log(`[Publisher] Updated blog archive.`);
        }
    }

    // 6. Update Homepage Ticker (index.html)
    const indexPath = path.join(__dirname, 'index.html');
    if (await fs.pathExists(indexPath)) {
        let indexContent = await fs.readFile(indexPath, 'utf-8');
        const tickerHtml = `<!-- SWARM_TICKER_START -->
<div id="news-ticker" class="news-ticker">
  <div class="nt-inner">
    <span class="nt-label">Maple Feed</span>
    <a href="/blog/${draft.slug}.html" class="nt-link">
      <span>${draft.title}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    </a>
  </div>
</div>
<!-- SWARM_TICKER_END -->`;
        
        const tickerRegex = /<!-- SWARM_TICKER_START -->[\s\S]*?<!-- SWARM_TICKER_END -->/;
        if (tickerRegex.test(indexContent)) {
            indexContent = indexContent.replace(tickerRegex, tickerHtml);
            await fs.writeFile(indexPath, indexContent);
            console.log(`[Publisher] Updated homepage ticker.`);
        }
    }

    // 7. Mark as Published (Optional: move to a 'published' folder or update draft)
    draft.status = 'published';
    draft.published_at = new Date().toISOString();
    await fs.writeJson(draftPath, draft, { spaces: 2 });
    
    console.log(`[Publisher] SUCCESS: ${draft.title} is now live.`);
}

// Execution
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node publish-blog.js <draft-filename.json>');
    process.exit(1);
}

publish(args[0]).catch(err => {
    console.error(`[Publisher Error] ${err.message}`);
    process.exit(1);
});
