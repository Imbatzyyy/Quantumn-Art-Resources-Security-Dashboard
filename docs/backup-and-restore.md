# Encrypted logical backups and recovery

The backup script encrypts the CLI schema and data exports in memory using AES-256-GCM. It writes only the authenticated ciphertext, creates files with mode 0600, refuses overwrites, and never prints row contents or encryption keys. Backups are ignored by Git. Keep the 32-byte base64 `HRMS_BACKUP_KEY` separately from the backup.

```sh
node scripts/encrypted-backup.mjs /secure/destination/date.hrmsbackup
node scripts/encrypted-backup.mjs --verify /secure/destination/date.hrmsbackup
```

These commands require a linked, authenticated Supabase CLI and `HRMS_BACKUP_KEY` in the process environment. Do not put the key into the repository, a shell command saved in history, or a CI log. The release workstation stores its key in macOS Keychain under service **Quantum HRMS encrypted backups**, account **quantumnhr**.

## What is and is not backed up

Included: `public`, `private`, `auth`, and `storage` schema/data exported by the CLI, including users, HR records, policies, functions, audit records, and Storage metadata.

Not included: Storage file bytes (photos and document attachments), Netlify/Supabase configuration or secrets, DNS, provider-managed internals excluded by the CLI, or a point-in-time recovery stream. Schema/data exports are separate snapshots; for strict cross-table consistency of a live busy system, take a maintenance-window/provider-supported snapshot. This is not a full disaster-recovery service.

## Tested restore drill

```sh
node scripts/encrypted-backup.mjs --local /secure/destination/local-fixture.hrmsbackup
node scripts/verify-backup-restore-local.mjs /secure/destination/local-fixture.hrmsbackup
```

The drill rejects production backups. It restores the schema and data into a uniquely named disposable database in the local Supabase container, validates user/profile counts and RLS-table presence, and drops only that database. It does not reset the normal local project. Authentication secrets and records are not printed.

Production recovery must use a separate destination first, matching extensions and roles. Restore Storage objects separately, reconfigure secrets and Auth URLs, invalidate old sessions, then test login, RLS, document access and record counts before switching traffic. Never run the local drill against production or use a blind `db reset`.

## Remaining operational requirement

The release has an encrypted pre-deployment database backup and a fictional-data restore test. An independently stored encrypted copy, Storage-file backup, retention schedule and a recurring operator/provider recovery drill still need an organization-owned destination. No personal access token has been copied into GitHub and no paid backup service was enabled. Until those are arranged, do not call this complete disaster recovery.
