# Dependency Management & Software Supply Chain Security

The application uses an explicit, multi-ecosystem dependency management strategy
spanning the Python Flask backend, React frontend, and Flutter mobile client.
This structure ensures reproducible, deterministic builds across development,
Docker, and CI environments while continuously monitoring for vulnerable or
outdated third-party components (OWASP A06:2021).

---

## 1. Multi-Tier Dependency Manifests & Lockfiles

| Tier | Manifest (Declared) | Lockfile (Resolved) | Deterministic Install Command |
| :--- | :--- | :--- | :--- |
| **Backend (Python)** | `requirements.txt` | `requirements.lock` | `pip install --no-cache-dir -r requirements.lock` |
| **Development / Audit**| `requirements-dev.txt`| N/A (inherits lock) | `pip install -r requirements-dev.txt` |
| **Frontend (React)** | `frontend/package.json` | `frontend/package-lock.json` | `npm ci` (inside `frontend/`) |
| **Mobile (Flutter)** | `mobile/pubspec.yaml` | `mobile/pubspec.lock` | `dart pub get` (inside `mobile/`) |

### Python Pinning Policy
- `requirements.txt` declares direct production dependencies grouped by domain
  (Core Framework, Database & Migrations, Authentication & Security, Integrations).
  Every package is strictly pinned (`==`) to tested versions to avoid runtime drift.
- `requirements.lock` captures the full transitive dependency tree (88 packages)
  generated from a verified environment via `pip freeze`.
- `requirements-dev.txt` isolates developer utilities (e.g., `pip-audit`) to keep
  production Docker images lean.

### Deterministic Container Builds
In `Dockerfile`:
- **Stage 1 (Frontend):** Uses `npm ci` rather than `npm install`. This guarantees
  that the exact dependency versions specified in `package-lock.json` are installed
  without modifying the lockfile.
- **Stage 2 (Backend):** Checks for `requirements.lock` and installs all locked
  packages directly, falling back to `requirements.txt` only if a lockfile is absent.

---

## 2. Automated Vulnerability Scanning & Tooling

### Local Multi-Stack Audit Utility
Run from the repository root:

```sh
.venv/bin/python scripts/audit_dependencies.py --check-lockfile
```

The script performs automated checks:
1. **Manifest Parity:** Verifies that every package declared in `requirements.txt`
   has an exact pinned counterpart in `requirements.lock`.
2. **Dependency Tree Integrity (`pip check`):** Confirms there are no missing,
   conflicting, or broken requirements in the active Python environment.
3. **Python CVE Vulnerability Scanning (`pip-audit`):** Queries PyPI and OSV
   advisories for known vulnerabilities in installed packages.
4. **Frontend Audit (`npm audit`):** Runs `npm audit --audit-level=high` inside
   `frontend/` to flag high/critical frontend security advisories.
5. **Mobile Lockfile Validation:** Confirms `pubspec.lock` presence and integrity.

### Automated GitHub Dependabot
Automated weekly scans are configured in `.github/dependabot.yml` across 5 ecosystems:
- `pip` (root directory `/`)
- `npm` (directory `/frontend`)
- `pub` (directory `/mobile`)
- `docker` (container base images in `/`)
- `github-actions` (workflow action versions)

### Continuous Integration (CI)
The GitHub Actions workflow at `.github/workflows/dependency-audit.yml` triggers
on every pull request and push modifying dependency files. It automatically enforces:
- Lockfile installation integrity.
- `pip check` zero-error validation.
- `scripts/audit_dependencies.py --check-lockfile` verification.
- `npm audit --audit-level=high` checks.

---

## 3. Maintenance & Update Workflow

### Adding or Updating a Python Dependency
1. Add the package to `requirements.txt` with an explicit pinned version.
2. Install into the virtual environment:
   ```sh
   .venv/bin/pip install <package>==<version>
   ```
3. Regenerate `requirements.lock`:
   ```sh
   .venv/bin/pip freeze > requirements.lock
   ```
4. Verify manifest-lockfile parity and tree integrity:
   ```sh
   .venv/bin/python scripts/audit_dependencies.py --check-lockfile
   ```

### Resolving Vulnerabilities
When `pip-audit` or Dependabot reports an advisory:
1. Inspect the advisory fix version.
2. Update the version constraint in `requirements.txt` and install it.
3. Re-run tests (`.venv/bin/python -m unittest discover -s tests -v`) to prevent regressions.
4. Regenerate `requirements.lock`.

---

## 4. Verification

Run the comprehensive test suite from the repository root:

```sh
.venv/bin/python -m unittest discover -s tests -v
```

`tests/test_dependency_management.py` verifies:
- `requirements.txt` syntax, strict pinning (`==`), and absence of duplicates.
- Complete coverage of declared packages in `requirements.lock`.
- Clean `pip check` execution.
- Valid multi-ecosystem Dependabot configuration.
- Presence and valid format of `package-lock.json` and `pubspec.lock`.
- Reproducible installation commands in `Dockerfile` (`npm ci`, `requirements.lock`).

---

## References
- OWASP Vulnerable and Outdated Components: https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/
- Python Packaging Authority (PyPA) Reproducible Builds: https://packaging.python.org/
- GitHub Dependabot Documentation: https://docs.github.com/en/code-security/dependabot
