# Input validation and safe rendering

`app/utils/input_validation.py` provides reusable server-side validators.
JSON requests must contain a valid JSON object, not null, an array, or a scalar.
Validation failures return HTTP 400 with `code: invalid_input`, `field`, and a
human-readable `error`/`message`. The request-body limit defaults to 16 MiB
(`MAX_CONTENT_LENGTH` in bytes); oversized bodies return HTTP 413 when read.
Configure equivalent request limits at the reverse proxy as well.

The field checks added in this change cover:

- API login, registration, profile updates, OTP verification, Google token input,
  and 2FA toggles.
- Registration email sending and all actions of the password-reset JSON API,
  including the mobile alias.
- API manual diagnosis (bounded list of symptom names and a positive crop ID),
  API chat, assistant messages, and support-chat sends.
- Web login/register/reset form password maximums and six-digit OTP formats.
- Farmer/staff login redirect targets through the shared relative-URL check.

Names allow Khmer, Unicode, apostrophes, and other normal free text. Email syntax
is checked with the existing email-validator dependency without a DNS lookup.
Text fields are bounded to the database/UI limits. 2FA accepts JSON booleans,
not truthy strings such as `"false"`. API crop IDs must be positive JSON integers,
and symptoms must be 1–100 nonempty strings of at most 255 characters each.

Passwords are never trimmed, lowercased, HTML-escaped, or silently truncated.
New API passwords follow the existing web form minimum of six characters and
have a 1024-character maximum; login verification does not impose the new-password
minimum. This preserves existing short-password accounts. This change does not
introduce a new password-strength or breached-password policy.

## Support-chat XSS fix

Both farmer/topbar and admin chat previously inserted stored messages and URLs
into innerHTML. They now use `support_chat_render.js`, which creates DOM nodes
and assigns message text with textContent. Markup is displayed as literal text,
including for older stored rows. No database rewrite is needed.

Image/audio attachment references must match the application's generated support
upload paths. Location attachments must have finite latitude/longitude within
valid ranges. URLs are assigned as DOM properties; map coordinates are URL-encoded,
and new-tab links use noopener/noreferrer. Unsafe legacy attachment references
are not rendered. Support chat is plain text, not a rich-HTML editor.

Do not sanitize every field by stripping punctuation or escaping before storage.
Keep SQLAlchemy parameterized queries, Jinja autoescaping/tojson, and React's text
rendering. For a future rich-HTML field, use a maintained allowlist sanitizer and
validate URLs separately. Validation alone is not an XSS or SQL-injection defense.

## Scope and verification

This is a targeted hardening of the listed routes plus global JSON/body checks.
It is not a complete field-schema audit of every admin/expert endpoint, a rich-HTML
sanitizer, or file-content verification. Upload extension/MIME/signature checks
and other innerHTML consumers need their own review.

```sh
.venv/bin/python -m unittest discover -s tests -v
node --test tests/test_support_chat_render.cjs
```

Tests cover malformed JSON, wrong field types, size limits, Unicode/password
preservation, unsafe redirects, attachment URL checks, and invalid real auth-route
requests failing before database access. Renderer tests exercise literal attack
markup, unsafe URLs, and valid image/audio/location rendering with a DOM stub;
they are not a full browser end-to-end test.

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
