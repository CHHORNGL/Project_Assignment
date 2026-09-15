# Password hashing

All application password creation and reset paths use `User.set_password()`.
It stores a salted Werkzeug scrypt hash with explicit parameters
`n=131072, r=8, p=1` and a fresh 16-character random salt. Passwords are not
stored in plaintext or reversibly encrypted. The encoded hash contains the
algorithm, parameters, salt, and derived value and fits the existing 255-character
column; no database migration is needed.

These parameters follow the OWASP scrypt baseline:
https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
Each hashing operation uses approximately 128 MiB of memory, so account for
concurrent login requests when sizing production workers and applying login rate
limits. No additional Python dependency is required.

## Existing accounts

`User.check_password(password)` verifies existing Werkzeug PBKDF2 and scrypt
hashes without modifying them. Plaintext and deprecated fast-hash formats are
rejected; accounts using those formats need a password reset.

Farmer, staff, and API password login call `check_password(password, upgrade=True)`.
After successful password verification, this stages a fresh scrypt hash when the
old hash is PBKDF2 or has scrypt parameters below the policy. The login transaction
commits the upgrade, including when an email verification or second-factor code
is issued. Hash upgrading does not itself authenticate the session or bypass
existing verification checks. Failed password checks never change the stored
hash. Scrypt hashes meeting or exceeding all policy parameters are retained.

No bulk conversion is possible without knowing passwords. Accounts upgrade as
users log in with passwords or reset them. OAuth/passkey logins do not upgrade
password hashes because they do not supply a password.

## Verification

Run from the project root:

```sh
.venv/bin/python -m unittest discover -s tests -v
```

Tests cover distinct salts, Unicode passwords, wrong passwords, legacy upgrades,
malformed inputs, retaining stronger parameters, and persistence in an isolated
in-memory SQLite database. They do not access the configured application database.

Password hashing protects stored passwords; it does not fix the separately
identified Telegram authentication bypass or unrestricted credentialed CORS.
