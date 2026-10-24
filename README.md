# thedrytextco.in

The website is generated from `source/`, and Vercel serves the generated files from `main` as they are (there is no build step on Vercel).

- `source/site.html`: the shared shell, every core page, the one stylesheet and the one script
- `source/pages/*.html`: Longhand pieces, service pages and case studies (a JSON header, then the page body)
- `source/god.js`, `source/god.css`: God mode, loaded only when someone turns it on
- `source/mails.json`, `source/work.json`: the cold mails and the client pieces on the Work page
- `source/images/`: photos and client logos
- `source/build.py`: writes every page, `assets/`, `images/`, the sitemap, the feed and `vercel.json`

To build:

    cd source && python3 build.py

Then check `git status`, commit and push. A Longhand piece dated in the future waits for its day; the daily job publishes it.
