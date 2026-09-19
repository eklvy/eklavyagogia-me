# eklavyagogia.me

Static site: `index.html` + `style.css` + `script.js`. No build step — open `index.html`
in a browser to preview, or deploy the folder as-is.

## Before you publish, edit these

Search each file for the placeholder text and swap in your own words:

- `index.html` → hero role line, About paragraph, About facts (city / focus / currently),
  LinkedIn headline + two highlight bullets, contact email.
- GitHub username is set once, at the top of `script.js`: `const GH_USER = 'eklvy';`
- LinkedIn URL appears three times in `index.html` (hero button, Connect card, footer) —
  find-and-replace if it ever changes.

## Optional: official LinkedIn badge

For a badge that auto-syncs with your live profile photo/headline, generate one at
developer.linkedin.com/member-profile-plugin (you'll need to be logged into LinkedIn) and
paste its two snippets into `<div id="linkedin-badge">` and just before `</body>` in `index.html`.

## Deploy to eklavyagogia.me

See the step-by-step in the chat where this was built. Short version: push this folder to a
GitHub repo, turn on GitHub Pages, then point your domain's DNS at it and set it as the
custom domain in the repo's Pages settings.
