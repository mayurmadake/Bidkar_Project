# Account Register v3

Next.js + TypeScript account register website.

This version uses a permanent local file database, so it does not need Supabase, SQL setup, or environment variables to run.

## Features

- Companies, common sites, common vendors and transactions
- Cash, UPI and cheque validation
- Opening balance confirmation for every company when the register opens
- "Yes" uses a manually entered opening balance
- "No" uses yesterday's net balance as the opening balance
- Summary totals and printable PDF-style report
- Daily activity log files for add, edit, delete and report print actions

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

For production, keep the database file outside the deployed source folder and set:

```text
ACCOUNT_REGISTER_DB_PATH=/persistent/account-register/account-register.json
```

Activity logs are saved as daily `.log` files. By default they are written to:

```text
data/activity-logs/YYYY-MM-DD.log
```

For production, keep logs outside the deployed source folder and set:

```text
ACCOUNT_REGISTER_LOG_DIR=/persistent/account-register/activity-logs
ACCOUNT_REGISTER_TIME_ZONE=Asia/Kolkata
```

This means entries remain available after closing the browser and opening it again. The data also remains if browser cache/site storage is cleared, because entries are not stored in the browser.

Important notes:

- keep the `data/account-register.json` file safe
- deleting this file deletes the register database
- data is stored on the computer/server running `npm run dev`
- member permissions are not enforced by a server
- the live database file is ignored by git and should not be deployed from development
- activity log files are ignored by git and should not be deployed from development
- deployment must preserve the production `data/account-register.json` file
- production transactions dated `2026-10-01` through `2026-10-03` are protected from stale full-database saves

Back up `data/account-register.json` regularly if you want an extra copy of the register.

## Optional Supabase Files

The old Supabase schema is still kept in `supabase/schema.sql` only as a reference. It is not required for the local version.
