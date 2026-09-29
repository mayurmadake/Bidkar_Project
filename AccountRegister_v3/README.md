# Account Register v3

Next.js + TypeScript account register website.

This version uses a permanent local file database, so it does not need Supabase, SQL setup, or environment variables to run.

## Features

- Companies, common sites, common vendors and transactions
- Cash, UPI and cheque validation
- Opening balance confirmation for every company when the register opens
- "Yes" uses a manually entered opening balance
- "No" uses yesterday's net balance as the opening balance
- Summary totals, JSON export and printable PDF-style report

## Setup

1. Install dependencies:

```bash
npm install
```

2. Run locally:

```bash
npm run dev
```

3. Open:

```text
http://localhost:3000
```

4. The register opens directly.

## Permanent Data Storage

Data is saved on disk in this project folder:

```text
data/account-register.json
```

This means entries remain available after closing the browser and opening it again. The data also remains if browser cache/site storage is cleared, because entries are not stored in the browser.

Important notes:

- keep the `data/account-register.json` file safe
- deleting this file deletes the register database
- data is stored on the computer/server running `npm run dev`
- member permissions are not enforced by a server

Use **Export JSON** regularly if you want an extra backup copy of the register.

## Optional Supabase Files

The old Supabase schema is still kept in `supabase/schema.sql` only as a reference. It is not required for the local version.
