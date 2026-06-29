# Integrated Agricultural Expert System 🌾
An advanced, multi-role expert system designed to assist farmers, experts, and administrators in diagnosing crop diseases, providing real-time weather-informed recommendations, and managing agricultural knowledge. 

This project was developed in collaboration with university peers and advisors to create an accessible tool tailored to low-technical-literacy farmers (supporting both English and Khmer language configurations, Khmer lunar calendar alignment, and adaptive UI wizards).

---

## 🏗️ Architecture Overview

The application is architected as a decoupled system featuring a robust **Python Flask** backend serving APIs and administrative interfaces, integrated with a modern **React + Vite** frontend powering the client-side Diagnosis Wizard.

```mermaid
flowchart TD
    subgraph Client [Client-Side Presentation]
        A[Farmer Dashboard / HTML5] <-->|Interactive UI| W[Diagnosis Wizard / React + Vite]
        E[Expert / Admin Panels]
    end

    subgraph Backend [Flask Application Boundary]
        API[Blueprints / Routes]
        RE[Rule Engine Service]
        AI[OpenAI Assistant Service]
        WM[Weather Intelligence Service]
        TM[Seasonal Theme Manager]
    end

    subgraph Database [Storage & Persistence]
        DB[(PostgreSQL Database)]
    end

    subgraph External [External Services]
        OM[Open-Meteo API]
        CL[Calendarific / Nager.at API]
        OA[OpenAI API]
        GD[Google OAuth]
    end

    %% Routing Flow
    A & W & E <--> API
    API <--> RE & AI & WM & TM
    RE & AI & WM & TM <--> DB
    
    %% External Integration
    WM <--> OM
    TM <--> CL
    AI <--> OA
    API <--> GD
```

---

## ✨ Key Features

### 🩺 1. Rule-Based Crop Disease Diagnosis
* **Adaptive Clarification Wizard:** A React-based step-by-step wizard designed for low-literacy farmers that asks a maximum of 5–7 adaptive yes/no questions based on active symptom rules.
* **Scoring & Evaluation Algorithm:** Computes diagnostic scores dynamically utilizing:
  $$\text{Score} = (0.60 \times \text{Symptom Coverage}) + (0.20 \times \text{Precision}) + (0.20 \times \text{Expert Confidence}) - (0.45 \times \text{Contradiction Penalty})$$
* **Disease Classifications:** Automatically matches and logs diagnoses under *Fungal*, *Bacterial*, *Viral*, *Pest*, *Nutrient*, and *Environmental* categories.
* **Actionable Solutions:** Generates structured diagnostic results (Diagnosis, Evidence, Reason) accompanied by instant mitigation and long-term prevention guidelines.
* **Farmer Feedback Loop:** Collects helpfulness ratings and optional comments to build user-driven validation datasets.

### ☀️ 2. Ultra-Advanced Weather Intelligence
* **Localized Analytics:** Retrieves coordinate-based forecast data from Open-Meteo (no API key required).
* **Smart Agricultural Warnings:** Automatically calculates thresholds for risk conditions:
  * **Storm Risk:** High wind speeds ($>45 \text{ km/h}$) or thunderstorms.
  * **Heavy Rain & Waterlogging:** Precipitation volume projections ($>35\text{ mm}$).
  * **Heat Stress:** Extreme heatwave temperature thresholds ($>38^\circ\text{C}$).
  * **Pesticide Spray Window:** Analyzes wind speed to notify if spray drift is likely (safe under $25 \text{ km/h}$).
* **Resilient Architecture:** Implements server-side caching (10-min TTL), stale fallback storage, and local storage on the client side to remain operational during network interruptions.

### 🎨 3. Seasonal Theme Manager (Khmer Calendar Integration)
* **Automated Seasonal Transitioning:** Synchronizes dashboard styling with Cambodian agricultural cycles (Dry Season, Rainy Season) and national festivals.
* **Lunar Date Engine:** Uses the `khmerdate` library to convert Gregorian calendar coordinates into Khmer lunar coordinates (zodiac year, lunar month, moon phase).
* **Event Providers:** Connects to Calendarific or Nager.at APIs (with local fallbacks) to track holiday triggers.
* **Upload Pipeline:** Integrates with Cloudinary CDN for storing and serving seasonal interface animations.

### 🔒 4. Security & Role-Based Access Control (RBAC)
* **Granular Roles:** Supports three application access tiers:
  * `farmer` (Accesses dashboard, weather updates, diagnosis wizard, notifications).
  * `expert` (Manages rules, answers farmers' questions, reviews system suggestions).
  * `admin` (Performs overall system configuration, user auditing, database management).
* **Multi-Factor Auth & Passkeys:** Supports Google OAuth login flows alongside modern passwordless WebAuthn (Passkey) credentials.
* **Audit Trails:** Automatic system auditing logs database updates, role changes, and critical actions.

---

## 🛠️ Technology Stack

| Layer | Technologies & Frameworks |
| :--- | :--- |
| **Backend Core** | [Python 3.11](https://www.python.org/) • [Flask 2.3](https://flask.palletsprojects.com/) • [Gunicorn](https://gunicorn.org/) |
| **Database & ORM** | [PostgreSQL 15](https://www.postgresql.org/) • [SQLAlchemy 2.0](https://www.sqlalchemy.org/) • [Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/) |
| **Migrations** | [Alembic](https://alembic.sqlalchemy.org/) • [Flask-Migrate](https://flask-migrate.readthedocs.io/) |
| **Frontend UI** | [React 18](https://react.dev/) • [Vite 5](https://vitejs.dev/) • [Tailwind CSS 3](https://tailwindcss.com/) • [PostCSS](https://postcss.org/) |
| **Integration APIs** | [OpenAI (GPT-4o-mini)](https://openai.com/) • [Open-Meteo](https://open-meteo.com/) • [Calendarific](https://calendarific.com/) • [Authlib](https://authlib.org/) |
| **Localization** | Custom i18n subsystem (English/Khmer translation matrix with Khmer text normalizer) |
| **DevOps** | [Docker](https://www.docker.com/) • [Docker Compose](https://docs.docker.com/compose/) |

---

## 📁 Repository Structure

```hl
Project_Assignment/
├── app/                              # Flask Application Package
│   ├── blueprints/                   # Role-Based Routing modules
│   │   ├── admin/                    # Admin controls and crop configurations
│   │   ├── auth/                     # Session and WebAuthn authentications
│   │   ├── expert/                   # Diagnostic rule configurations
│   │   ├── farmer/                   # Farmer dashboard and history
│   │   ├── weather_intelligence/     # API endpoints for live weather summary
│   │   └── user/                     # Profile, avatar, and notification routes
│   ├── models/                       # SQLAlchemy Database Entities (Crop, Disease, Symptom, Rule, etc.)
│   ├── services/                     # Business Logic Services
│   │   ├── rule_engine.py            # Custom diagnostic rule matching algorithms
│   │   ├── weather_intelligence/     # Open-Meteo clients, warning limits, caching
│   │   ├── theme_manager.py          # Theme state transitions
│   │   ├── seasonal_theme.py         # Cambodia holiday lookups (Calendarific/Nager)
│   │   └── openai_assistant.py       # OpenAI GPT assistance integrations
│   ├── static/                       # Compiled assets (CSS, JS, SVGs)
│   ├── templates/                    # Jinja2 HTML5 Layouts & Components
│   └── utils/                        # Internationalization, decorators, and layout helpers
├── frontend/                         # React Frontend for the Diagnosis Wizard
│   ├── src/                          # React components and Stepper pages
│   ├── package.json                  # Node packaging configurations
│   ├── tailwind.config.js            # Design token properties
│   └── vite.config.js                # Vite build outputs configured to backend static paths
├── docs/                             # Core specifications and architecture blueprints
├── Dockerfile                        # Multi-stage production container build script
├── docker-compose.yml                # Docker orchestrations (App service + PostgreSQL server)
├── requirements.txt                  # Python dependencies declaration
├── entrypoint.sh                     # Database migration & seed start helper
└── seed_*.py                         # System default seeding utilities (Admin, Expert, Farmer, Rules)
```

---

## ⚙️ Installation & Local Setup

You can run this project locally on your host machine or via Docker.

### Option A: Local Run (Development)

#### 1. Setup Python Virtual Environment
Ensure you have Python 3.11 installed.
```bash
# Clone the repository and enter directory
cd Project_Assignment

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### 2. Configure Local Environment Variables
Create a `.env` file in the root directory by copying the example:
```bash
cp .env.example .env
```
Update the connection string and API key values in `.env`:
* Configure `DATABASE_URL` to point to your local PostgreSQL instance (e.g., `postgresql+psycopg2://postgres:123@localhost:5432/AssExpertsystem`).
* Provide your `OPENAI_API_KEY` for AI assistant capabilities.
* Provide your `CALENDARIFIC_API_KEY` or set `THEME_EVENTS_PROVIDER=auto`.

#### 3. Build React Frontend
Ensure you have Node.js installed.
```bash
cd frontend
npm install
npm run build
cd ..
```
*Note: Vite will compile assets directly into the backend static resources directory (`app/static/diagnosis-wizard`).*

#### 4. Prepare Database & Seeds
```bash
# Set environment context
export FLASK_APP=run.py

# Setup database schemas and create tables
python setup_db.py

# Stamp migrations to head
flask db stamp head

# Populate database with agricultural profiles & roles
python seed_roles.py
python seed_permissions.py
python seed_admin.py
python seed_expert.py
python seed_farmer.py
python seed_rule_based_knowledge.py
```

#### 5. Launch Development Server
```bash
python run.py
```
Open `http://localhost:5000` in your web browser.

---

### Option B: Run with Docker (Recommended)

Docker Compose automates the React builds, sets up PostgreSQL, executes database migrations, seeds initial data, and starts the production Gunicorn web server.

1. Ensure Docker Desktop is installed and running.
2. Setup your `.env` configuration file in the project root folder.
3. Boot the environment:
   ```bash
   docker-compose up --build
   ```
4. Once database checks pass and seeding succeeds, open `http://localhost:5001` in your browser.

---

## 🌾 Seeding Data Configurations

Our pre-configured knowledge database (`seed_rule_based_knowledge.py`) populates the system with rules and symptoms for the following crops:
- 🌾 **Rice** (Blast, Bacterial Leaf Blight, Brown Planthopper, Stem Borer, Nitrogen Deficiency)
- 🥔 **Potato** (Early Blight, Late Blight, Common Scab, Potato Aphids)
- 🍅 **Tomato** (Late Blight, Bacterial Canker, Tomato Mosaic Virus, Blossom End Rot)
- 🥒 **Cucumber** (Downy Mildew, Powdery Mildew, Cucumber Mosaic Virus, Iron Deficiency)
- 🌶️ **Chili Pepper** (Anthracnose, Bacterial Wilt, Chili Leaf Curl Virus, Nitrogen Deficiency)
- 🍌 **Banana** (Panama Disease, Sigatoka, Banana Bunchy Top Virus, Potassium Deficiency)
- 🌽 **Corn** (Northern Corn Leaf Blight, Common Smut, Maize Dwarf Mosaic Virus, Nitrogen Deficiency)
- 🍠 **Cassava** (Cassava Mosaic Disease, Cassava Brown Streak Disease, Cassava Bacterial Blight)

---

## 🤝 Collaboration & Review
For reviews, bugs, and development:
* Code validation scripts can be tested using `python smoke_test.py`.
* Reviewers can invoke specialized instructions in [.github/agents/code-reviewer.agent.md](file:///Users/ahzarjy/Documents/Ai/Project_Assignment/.github/agents/code-reviewer.agent.md).
* Themes can be completely reset and reseeded to defaults using `python reset_themes.py`.
