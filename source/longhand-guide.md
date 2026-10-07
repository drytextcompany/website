# Longhand: how the daily pieces are written

The daily Longhand task reads this file before it drafts. Edit it freely: change a rule here and
the next draft follows it. Kept in source/, so it is never served on the website.

## The arrangement

- One new piece is drafted each morning, dated three days ahead, and published on its date.
  Granth does not need to approve pieces (agreed 3 October 2026), but can still edit or delete
  any draft before its date.
- Byline: Granth Hirapara.
- Every drafted piece carries `"drafted_by": "Claude"` in its header. The build ignores it. Delete
  that line when you have read and approved a piece; nothing else changes.
- To stop: tell Claude to stop, or pause the "Publish the day's Longhand piece" scheduled task.

## Who it is for

Founders, marketing heads and small-business owners in India (Ahmedabad and Gujarat first,
anywhere after that) who have to get words written and are not writers. They read on a phone.
Each piece should leave them able to do one thing better this week, and make it obvious that
we are the people to call when they would rather not.

## Voice (copy the existing pieces, not this list)

- Dry, specific, sure of itself. Short declarative sentences. One joke a section at most, and
  it should be an observation, not a pun stuck on.
- Concrete Indian examples: a dentist in Navrangpura, a mother on WhatsApp after dinner, a
  hoarding on SG Highway, a CA's LinkedIn. Rupees as `&#8377;4,800`, lakhs and crores, Indian
  comma placement (`&#8377;8,00,000`).
- British and Indian spelling: recognise, colour, programme, per cent.
- Opinions stated as opinions. Advice the reader can check by reading a draft.
- Every claim either testable or obviously an opinion.

## Hard rules

- **No dashes of any kind** as punctuation: no em dash, en dash, `&mdash;`, `&ndash;`, or a
  spaced hyphen. Use commas, full stops, colons or parentheses. Hyphens inside words
  (five-page, follow-up) are fine.
- **Never invent facts about The Dry Text Co.** No made-up clients, projects, results, quotes,
  numbers, conversations or "last month a client asked us" stories. Facts about us may only come
  from this repo: `source/site.html` (About, services, team), `source/pages/services-*.html`
  (prices), `source/work.json`, `source/mails.json`, the case studies in `source/pages/work-*.html`,
  and the Longhand pieces already written. When a piece would be better with a real story, write
  it without one.
- No invented statistics or studies. No "research shows". No market prices unless they are
  already stated in an existing piece or service page.
- Never criticise a real, named Indian brand or person. Praise is fine if it is common knowledge.
- None of the nine words from "Nine words that make every Indian brand sound the same"
  (seamless, robust, bespoke, curated, passionate, synergy, disrupt, solutions, and the
  "We don't just X, we Y" shape). Also none of: delve, elevate, unlock, unleash, navigate (except
  literally), landscape (except literally), game-changer, leverage, journey (except literally),
  "in today's fast-paced world", "let's dive in", "in conclusion", "whether you're a X or a Y".
- No exclamation marks. No emoji.
- Do not use "not X, but Y" or "It isn't X. It's Y." more than once a piece; it is the easiest
  shape to overuse.
- 650 to 1,000 words of prose. Read time on the meta line: words divided by 140, rounded.

## The shape of a piece

Copy the newest piece in `source/pages/longhand-*.html` exactly for markup. In short:

- Header JSON: `path` (`/longhand/<slug>`), `parent` (`/longhand`), `kind` (`note`), `date`,
  `author`, `drafted_by`, `crumb` (two to four words), `title_short` (the human title), `title`
  (search title, ending `| The Dry Text Co.`, under 70 characters before the pipe), `desc` (under
  160 characters), `blurb` (under 120 characters).
- File name: `source/pages/longhand-<short-slug>.html`.
- Eyebrow `Longhand &middot; <category>`. Categories so far: what things cost, cold mail,
  language, brand voice, ghostwriting, website copy, working together, words. Add new ones
  sparingly.
- `h1` ending in a full stop, a `lede` of one or two sentences, the `nt-meta` line (Granth
  Hirapara, the date written as "6 October 2026", read time), and a lowercase `note` in the
  margin: one dry line, no capital letters, like a pencil aside.
- One `prose` section with `h2` subheads (the first `h2` carries the id the section's
  `aria-labelledby` points to), exactly one `p class="pull"`, lists where they help.
- Two or three internal links in the prose: to Longhand pieces already published (or due
  before this piece's date), service pages, `/work` or `/contact`.
- A closing CTA section: an `h2` question and two links, `/contact` as the button and one
  relevant page as the `pen-link`.
- Curly quotes as `&ldquo;` `&rdquo;`; straight apostrophes are fine in prose.

## Topics

Pick the first unticked topic that does not repeat or overlap a published piece. Tick it
(`[x]` and the date) in the same commit as the draft. A timely topic with a window takes
priority when the draft's date falls inside that window. When fewer than five remain, add five
new ones at the bottom in the same spirit: practical, specific to writing for Indian businesses,
answerable without inventing anything about us.

Already published: what content writing costs; 27 cold mails; Gujarati or English; what brand
voice is; what a LinkedIn ghostwriter does; the About page test; how to brief a writer; what a
website costs; nine overused words.

- [x] Your homepage headline has one job (3 October 2026)
- [x] How to write a WhatsApp broadcast people don't mute (4 October 2026)
- [x] Copywriter or content writer: which one you actually need (5 October 2026)
- [x] How to give feedback on a draft, so round two is the last (6 October 2026)
- [x] How long an Instagram caption should be (7 October 2026)
- [x] Writing the Google Business Profile description, the most read paragraph you'll never think about (website copy) (8 October 2026)
- [ ] Why every Diwali post looks the same, and how to write one that doesn't (social). Window: drafts dated 20 October to 2 November 2026. Diwali falls on 8 November 2026; confirm before writing.
- [x] How to ask a customer for a testimonial you can actually use (words) (9 October 2026)
- [x] The cold mail first line: what to write before they decide to delete (cold mail) (10 October 2026)
- [ ] Do you need a tagline? (brand voice)
- [ ] Hinglish in brand copy: when it works and when it's a costume (language)
- [ ] Writing an FAQ page from the questions people actually ask (website copy)
- [ ] Exclamation marks, and other ways copy sounds nervous (words)
- [ ] Writing a product description for an Indian D2C brand (website copy)
- [ ] How many revisions should a writer include, and what counts as one (working together)
- [ ] Email subject lines that get opened without lying (cold mail)
- [ ] Company page or founder profile: where a B2B brand should post on LinkedIn (ghostwriting)
- [ ] Writing a hoarding: seven words at sixty kilometres an hour (advertising)
- [ ] The Contact page: the last page before money, and the least written (website copy)
- [ ] How to write a job post that good people answer (words)
- [ ] Writing a case study when the client won't let you name them (working together)
- [ ] Should your website show prices? (what things cost)
- [ ] Brochures: does anyone read them, and what to put in the one they do (words)
- [ ] Writing for doctors, lawyers and CAs without sounding like a pamphlet (words)
- [ ] The small words on a website: buttons, error messages, empty states (website copy)
