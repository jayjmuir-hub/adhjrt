# Crawler-facing tags live in each page's literal head and nowhere else

**Ruling.** Title, description, canonical, `og:` and `twitter:` tags, `robots` and JSON-LD sit in the literal `<head>` of every served page. None of them is in `<helmet>`, which keeps only what a browser alone needs. Moving a tag means moving it, not copying it. Every public page carries the same exact `og:site_name` string and a WebSite JSON-LD block with the brand name.

**Why.** The `.dc.html` pages move `<helmet>` into the head with JavaScript after load. Link-preview scrapers do not run JavaScript, so every shared link arrived as a bare URL, on a site that spreads by parents forwarding links. The same gap meant a page that claimed `noindex` did not carry it until scripts ran. A copy left in `<helmet>` produces a second `<title>` once the page boots. The site name is pinned exactly because a near-miss string was already live and search still showed the domain.

**Against, and why it lost.** `<helmet>` keeps page metadata in one component block. It only works in a browser, and crawlers are not browsers.

**Where in the code.** `Quins JRT.dc.html`, `Scores & Standings.dc.html`, `app.html`, `legal.html`, `rules.html`, `tests/test-head-metadata.js`.
