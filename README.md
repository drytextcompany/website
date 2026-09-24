# thedrytextco.in

The website is built from one source file.

- `source/site.html` — the site itself (edit this, not `index.html`)
- `source/mails.json` — the 27 cold mails
- `source/work.json` — the client pieces on the Work page
- `source/images/` — photos and client logos
- `source/build.py` — embeds the images, drops in the JSON, writes `../index.html`

To build:

    cd source && python3 build.py

Then commit and push. Vercel deploys `main` to thedrytextco.in.
