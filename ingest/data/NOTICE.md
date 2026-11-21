# Where `companies-open.csv` comes from

This file lists 27,509 companies and the applicant-tracking-system board each
one publishes its jobs on. It is what lets the board cover the open market
instead of a hand-picked list.

## Source and licence

Derived from **kalil0321/ats-scrapers**
<https://github.com/kalil0321/ats-scrapers>, directory `ats-companies/`,
commit `6b44a1b` (2026-09-02).

That repository is released under the **MIT License**, a copy of which is kept
next to this file as `LICENSE-kalil0321-ats-scrapers.txt`. The MIT licence
requires only that its copyright notice travel with the data. Keep that file
in the repo and you have met the obligation.

Rows were filtered to the eight ATSes this board has adapters for (Greenhouse,
Lever, Ashby, Workable, SmartRecruiters, Recruitee, BambooHR, Breezy), stripped of malformed
slugs, and de-duplicated. Nothing else was changed.

## What this data is — and isn't

It is a list of company names and board slugs: which company uses which ATS.
It contains no job postings. The postings themselves are fetched fresh every
night from each company's own public ATS endpoint, and belong to the companies
that published them. Every Apply link goes straight to the employer's posting.

## A larger list, if you ever want it

A second public dataset, maintained by the UpstreamIt project
<https://github.com/ElliotGbaum/upstreamit>, covers about 4,000 more live
Greenhouse, Lever and Ashby boards. It is licensed **CC BY-SA 4.0**, which is
share-alike: if you mixed it in and then published or shared the combined
list, that list would also have to be CC BY-SA 4.0 with attribution. Workable
for a private repo; worth deciding deliberately before a public one. It was
left out of this file to keep the licensing simple.
