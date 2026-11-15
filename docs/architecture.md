# Monorepo Architecture & Directory Guide

This project is organized as a modular **full-stack monorepo** separating the Python Flask backend, React web wizard, Flutter mobile application, AI/ML pipelines, operational scripts, and documentation into dedicated top-level domains.

---

## Top-Level Directory Layout

```text
Project_Assignment/
├── backend/                          # Python Flask Backend Service
│   ├── app/                          # Core Flask Application Package
│   │   ├── blueprints/               # Role-based & feature route blueprints
│   │   │   ├── admin/                # Admin dashboard, settings, user/crop/role management
│   │   │   ├── api/                  # JSON REST endpoints for mobile & async web clients
│   │   │   ├── assistant/            # AI assistant chat endpoints
│   │   │   ├── auth/                 # Authentication, OAuth, and Passkey routes
│   │   │   ├── expert/               # Expert diagnosis review & knowledge base management
│   │   │   ├── farmer/               # Farmer dashboard, diagnosis engine, support chat
│   │   │   ├── main/                 # Public landing & health-check routes
│   │   │   ├── staff/                # Staff/Expert authentication portal
│   │   │   ├── user/                 # User profile, settings, and login activity
│   │   │   └── weather_intelligence/ # Weather forecast & agricultural risk endpoints
│   │   ├── forms/                    # WTForms validation classes
│   │   ├── models/                   # SQLAlchemy ORM entities
│   │   ├── services/                 # Domain services (Rule Engine, AI, Weather, Themes, Bakong)
│   │   ├── static/                   # Static assets (CSS, JS, compiled React wizard, uploads)
│   │   ├── templates/                # Jinja2 HTML5 templates & layouts
│   │   ├── utils/                    # Security headers, rate limiting, i18n, session security
│   │   ├── __init__.py               # Application factory (`create_app`)
│   │   ├── config.py                 # Environment-driven configuration
│   │   └── extensions.py             # Flask extension instances (`db`, `migrate`, `login_manager`, `oauth`)
│   ├── migrations/                   # Alembic database schema revisions
│   ├── seeds/                        # Database initialization & seeding scripts
│   │   ├── seed_admin.py
│   │   ├── seed_expert.py
│   │   ├── seed_farmer.py
│   │   ├── seed_permissions.py
│   │   ├── seed_roles.py
│   │   └── seed_rule_based_knowledge.py
│   ├── tests/                        # Backend Python unit & integration test suite
│   ├── uploads/                      # Persistent upload directory (mounted in Docker)
│   ├── alembic.ini                   # Alembic migration configuration
│   ├── entrypoint.sh                 # Production container entrypoint script
│   ├── requirements.txt              # Pinned direct Python dependencies
│   ├── requirements.lock             # Locked transitive Python dependencies
│   ├── requirements-dev.txt          # Development & security audit dependencies
│   ├── run.py                        # Local development server entrypoint
│   └── setup_db.py                   # Idempotent database schema bootstrapper
│
├── frontend/                         # React + Vite Diagnosis Wizard & Client Tests
│   ├── src/
│   │   ├── components/ui/            # Reusable UI primitives
│   │   ├── diagnosis/                # Adaptive Diagnosis Wizard pages & live evaluation
│   │   ├── lib/                      # Frontend API client & utilities
│   │   ├── diagnosis-main.jsx        # Wizard application entrypoint
│   │   └── index.css                 # Tailwind CSS stylesheet
│   ├── tests/                        # Node.js test suite (.cjs / .mjs)
│   ├── package.json                  # Node package manifest
│   ├── package-lock.json             # Locked npm dependency tree
│   ├── postcss.config.js             # PostCSS configuration
│   ├── tailwind.config.js            # Tailwind design tokens
│   └── vite.config.js                # Vite bundler config (outputs to `backend/app/static/diagnosis-wizard`)
│
├── mobile/                           # Flutter Cross-Platform Mobile Application
│   ├── lib/
│   │   ├── models/                   # Dart data models (`crop.dart`, `user.dart`)
│   │   ├── providers/                # State management (`auth_provider.dart`, `language_provider.dart`)
│   │   ├── screens/                  # Mobile UI screens (Dashboard, Scan, Chat, History, Settings)
│   │   ├── services/                 # REST API client & session cookie parser
│   │   ├── utils/                    # Bilingual English/Khmer translations
│   │   └── main.dart                 # Flutter application entrypoint
│   ├── test/                         # Dart / Flutter unit & widget tests
│   ├── android/                      # Android platform target
│   ├── ios/                          # iOS platform target
│   ├── macos/                        # macOS desktop target
│   ├── windows/                      # Windows desktop target
│   ├── pubspec.yaml                  # Dart package manifest
│   └── pubspec.lock                  # Locked pub dependencies
│
├── ai/                               # AI / ML Training, Inference & Datasets
│   ├── datasets/                     # Fine-tuning datasets & exported JSONL/CSV snapshots
│   │   ├── exports/                  # `export_to_jsonl.py` & `export_mixed_agri.py` outputs
│   │   └── train.json                # Instruction-tuning dataset
│   ├── deployment/                   # Standalone AI Inference API container service
│   ├── huggingface-space/            # Hugging Face Space ZeroGPU / Gradio application
│   └── training/                     # LoRA fine-tuning scripts & Colab notebooks
│
├── docs/                             # Project Documentation & API Specifications
│   ├── api/                          # OpenAPI 3.0 specs & Postman collections
│   ├── architecture.md               # Monorepo architecture reference (this document)
│   └── *.md                          # Security, Weather, Rule Engine & Migration guides
│
├── scripts/                          # Operational, Maintenance & Dataset CLI Utilities
│   ├── audit_dependencies.py         # Multi-ecosystem dependency & CVE auditor
│   ├── audit_image_dataset.py        # Vision training dataset verifier
│   ├── backfill_notifications.py     # Notification backfill utility
│   ├── check_subscriptions.py        # Subscription expiration notifier
│   ├── conversational_data.py        # Bilingual empathy & conversational dataset module
│   ├── convert_lora_to_gguf.py       # LoRA-to-GGUF quantization helper
│   ├── export_mixed_agri.py          # Mixed agricultural fact exporter
│   ├── export_to_jsonl.py            # Knowledge base to SFT JSONL exporter
│   ├── migrate_avatar_files_to_db.py # Avatar storage migration utility
│   ├── test_smtp_email.py            # SMTP verification utility
│   └── wait_for_database.py          # PostgreSQL readiness probe
│
├── .dockerignore                     # Docker build context exclusions
├── .env.example                      # Environment variable template
├── .gitignore                        # Git ignore rules
├── Dockerfile                        # Multi-stage production container build
├── docker-compose.yml                # Full-stack Docker Compose orchestration
├── pyrightconfig.json                # Python type-checker configuration
├── railway.json                      # Railway deployment configuration
└── README.md                         # Project overview & quickstart guide
```

---

## Common Workflows

### 1. Running the Backend Locally
```bash
source .venv/bin/activate
export FLASK_APP=backend/run.py

# Initialize & seed database
python backend/setup_db.py
flask --app backend/run.py db stamp head
python backend/seeds/seed_roles.py
python backend/seeds/seed_permissions.py
python backend/seeds/seed_admin.py
python backend/seeds/seed_expert.py
python backend/seeds/seed_farmer.py
python backend/seeds/seed_rule_based_knowledge.py

# Start server
python backend/run.py
```

### 2. Building the React Frontend
```bash
cd frontend
npm ci
npm run build
```

### 3. Running Test Suites
```bash
# Backend Python tests
.venv/bin/python -m unittest discover -s backend/tests -v

# Frontend JavaScript tests
node --test frontend/tests/*.cjs frontend/tests/*.mjs

# Dependency & lockfile audit
.venv/bin/python scripts/audit_dependencies.py --check-lockfile
```
