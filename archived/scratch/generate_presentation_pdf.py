import os
import subprocess
import sys
from pathlib import Path

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AgriSystem Presentation Deck - Expert System & AI Agent</title>
<style>
@page {
    size: 16in 9in;
    margin: 0;
}
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}
body {
    background-color: #0b1120;
    color: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Khmer OS Battambang", "Hanuman", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.slide {
    width: 16in;
    height: 9in;
    max-height: 9in;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    position: relative;
    padding: 34px 50px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: radial-gradient(circle at 10% 20%, #131d35 0%, #0b1120 75%);
}

/* Header Styles */
.slide-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid rgba(56, 189, 248, 0.25);
    padding-bottom: 10px;
    margin-bottom: 14px;
}
.header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.badge-row {
    display: flex;
    align-items: center;
    gap: 12px;
}
.tag-badge {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(52, 211, 153, 0.45);
    color: #34d399;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    padding: 3px 10px;
    border-radius: 9999px;
}
.tag-badge.ai {
    background: rgba(56, 189, 248, 0.15);
    border-color: rgba(56, 189, 248, 0.45);
    color: #38bdf8;
}
.tag-badge.warning {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.45);
    color: #fbbf24;
}
.project-subtitle {
    font-size: 12px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1px;
}
.slide-title {
    font-size: 30px;
    font-weight: 800;
    color: #f8fafc;
    letter-spacing: -0.5px;
}
.slide-title span {
    color: #38bdf8;
}
.slide-title span.green {
    color: #34d399;
}
.slide-title span.amber {
    color: #fbbf24;
}
.slide-num {
    font-size: 18px;
    font-weight: 800;
    color: #94a3b8;
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid rgba(100, 116, 139, 0.4);
    padding: 6px 14px;
    border-radius: 8px;
}

/* Body Layouts */
.slide-body {
    flex: 1;
    display: flex;
    gap: 20px;
    margin-bottom: 12px;
    min-height: 0;
}
.col-1 { flex: 1; display: flex; flex-direction: column; gap: 14px; }
.col-half { flex: 1; display: flex; flex-direction: column; gap: 14px; }
.col-third { flex: 1; display: flex; flex-direction: column; gap: 14px; }

/* Cards & Containers */
.card {
    background: rgba(30, 41, 59, 0.65);
    border: 1px solid rgba(71, 85, 105, 0.4);
    border-radius: 12px;
    padding: 16px 20px;
    backdrop-filter: blur(8px);
}
.card.highlight {
    background: rgba(30, 58, 138, 0.22);
    border-color: rgba(56, 189, 248, 0.45);
}
.card.emerald {
    background: rgba(6, 78, 59, 0.22);
    border-color: rgba(52, 211, 153, 0.45);
}
.card.amber {
    background: rgba(120, 53, 15, 0.22);
    border-color: rgba(245, 158, 11, 0.45);
}
.card-title {
    font-size: 16px;
    font-weight: 700;
    color: #e2e8f0;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.card-title.cyan { color: #38bdf8; }
.card-title.green { color: #34d399; }
.card-title.amber { color: #fbbf24; }

/* Lists & Bullets */
ul.bullet-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 7px;
}
ul.bullet-list li {
    font-size: 13.5px;
    line-height: 1.45;
    color: #cbd5e1;
    display: flex;
    align-items: flex-start;
    gap: 8px;
}
ul.bullet-list li strong {
    color: #f8fafc;
}
.dot {
    width: 6px;
    height: 6px;
    background: #38bdf8;
    border-radius: 50%;
    margin-top: 6px;
    flex-shrink: 0;
}
.dot.green { background: #34d399; }
.dot.amber { background: #fbbf24; }

/* Metrics Row */
.metric-row {
    display: flex;
    gap: 14px;
}
.metric-box {
    flex: 1;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(71, 85, 105, 0.45);
    border-radius: 10px;
    padding: 10px 14px;
    text-align: center;
}
.metric-val {
    font-size: 26px;
    font-weight: 800;
    color: #38bdf8;
    line-height: 1.1;
}
.metric-val.green { color: #34d399; }
.metric-val.amber { color: #fbbf24; }
.metric-label {
    font-size: 10.5px;
    text-transform: uppercase;
    color: #94a3b8;
    letter-spacing: 0.8px;
    margin-top: 3px;
}

/* Formula Box */
.formula-box {
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(56, 189, 248, 0.45);
    border-radius: 10px;
    padding: 12px 18px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 14.5px;
    color: #e0f2fe;
    line-height: 1.45;
    margin: 6px 0;
}
.formula-box .hl-var { color: #38bdf8; font-weight: bold; }
.formula-box .hl-op { color: #f43f5e; font-weight: bold; }
.formula-box .hl-pen { color: #fbbf24; font-weight: bold; }

/* Tables */
table.slide-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.8px;
    line-height: 1.35;
}
table.slide-table th {
    background: rgba(15, 23, 42, 0.9);
    color: #38bdf8;
    text-align: left;
    padding: 7px 10px;
    border-bottom: 2px solid rgba(56, 189, 248, 0.35);
    font-weight: 700;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.6px;
}
table.slide-table td {
    padding: 7px 10px;
    border-bottom: 1px solid rgba(51, 65, 85, 0.5);
    color: #cbd5e1;
}
table.slide-table tr:hover {
    background: rgba(30, 41, 59, 0.4);
}

/* Code Snippet Box */
.code-box {
    background: #090d16;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 10px 14px;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 11.5px;
    color: #a5b4fc;
    line-height: 1.4;
    overflow: hidden;
}

/* Speaker Notes Footer */
.speaker-notes {
    background: linear-gradient(90deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
    border-left: 4px solid #38bdf8;
    border-radius: 0 8px 8px 0;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
}
.speaker-notes.green-border { border-left-color: #34d399; }
.speaker-notes.amber-border { border-left-color: #fbbf24; }
.speaker-label {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #38bdf8;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
}
.speaker-label.green { color: #34d399; }
.speaker-label.amber { color: #fbbf24; }
.speaker-text {
    font-size: 12.8px;
    color: #cbd5e1;
    font-style: italic;
    line-height: 1.35;
}

/* Cover Specific */
.cover-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 18px;
}
.cover-title {
    font-size: 50px;
    font-weight: 900;
    color: #f8fafc;
    letter-spacing: -1px;
    line-height: 1.15;
    max-width: 1100px;
}
.cover-title span {
    color: #38bdf8;
}
.cover-subtitle {
    font-size: 22px;
    color: #94a3b8;
    max-width: 920px;
    font-weight: 400;
    line-height: 1.4;
}
.cover-badges {
    display: flex;
    gap: 14px;
    margin-top: 8px;
}
.cover-badge {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(71, 85, 105, 0.45);
    padding: 8px 18px;
    border-radius: 9999px;
    font-size: 13.5px;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 8px;
}
.cover-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(71, 85, 105, 0.35);
    padding-top: 14px;
    color: #64748b;
    font-size: 13px;
}

/* Architecture Flow Diagrams */
.arch-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    width: 100%;
}
.arch-node {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.arch-node.green { border-color: rgba(52, 211, 153, 0.45); }
.arch-node.amber { border-color: rgba(245, 158, 11, 0.45); }
.arch-node.purple { border-color: rgba(168, 85, 247, 0.45); }
.arch-title { font-size: 13.5px; font-weight: 700; color: #f8fafc; }
.arch-desc { font-size: 11.5px; color: #94a3b8; line-height: 1.35; }

/* Flow Sequence */
.flow-sequence {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}
.flow-step {
    flex: 1;
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11.5px;
    line-height: 1.35;
    color: #cbd5e1;
}
.flow-step strong { color: #38bdf8; display: block; font-size: 12px; margin-bottom: 2px; }
.flow-arrow { color: #64748b; font-size: 18px; font-weight: bold; flex-shrink: 0; }
</style>
</head>
<body>

<!-- ========================================== -->
<!-- SLIDE 1: COVER -->
<!-- ========================================== -->
<div class="slide">
    <div class="cover-content">
        <div class="tag-badge ai" style="font-size: 13px; padding: 6px 18px;">
            🌾 Executive Engineering Briefing • Department of AI & Software Architecture
        </div>
        <h1 class="cover-title">
            Integrated Agricultural Expert System & <span>AI Assistant</span>
        </h1>
        <p class="cover-subtitle">
            Core Architecture Breakdown: <strong>Expert System Knowledge Base</strong> & <strong>Self-Trained AI Agent (AI Train Pipeline)</strong>
        </p>
        <div class="cover-badges">
            <div class="cover-badge">🧠 <strong>Expert System:</strong> Forward-Chaining Scoring Engine</div>
            <div class="cover-badge">🤖 <strong>AI Model:</strong> AGY V2.0.0 (Qwen2.5-3B QLoRA)</div>
            <div class="cover-badge">🇰🇭 <strong>Bilingual:</strong> English & Authentic Khmer Script</div>
            <div class="cover-badge">⚡ <strong>Zero API Cost:</strong> Decoupled Hugging Face Space</div>
        </div>
    </div>
    <div class="cover-footer">
        <div><strong>Project:</strong> AgriSystem (Project_Assignment)</div>
        <div><strong>Engineering Leadership:</strong> Mao Seavik & Engineering Team</div>
        <div><strong>Prepared For:</strong> Manager Review & Production Presentation | September 2026</div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 2: EXECUTIVE SUMMARY & STRATEGIC VALUE -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge">Strategic Overview</span>
                <span class="project-subtitle">AgriSystem Architecture Overview</span>
            </div>
            <div class="slide-title">Executive Summary & <span>The Dual-Engine Vision</span></div>
        </div>
        <div class="slide-num">02 / 12</div>
    </div>

    <div class="slide-body">
        <div class="col-half">
            <div class="card highlight" style="flex: 1;">
                <div class="card-title cyan">🚨 The Critical Industry Problem in Cambodia</div>
                <ul class="bullet-list">
                    <li><span class="dot"></span><strong>Devastating Crop Losses:</strong> Pests and blights cause 30–50% yield drops due to late identification by rural farmers.</li>
                    <li><span class="dot"></span><strong>Low Technical Literacy:</strong> Farmers cannot navigate dense manuals or type elaborate English prompts into standard AI chat.</li>
                    <li><span class="dot"></span><strong>Commercial LLM Dangers:</strong> Generic models (ChatGPT, Gemini) hallucinate lethal pesticide doses and lack local Cambodian knowledge.</li>
                    <li><span class="dot"></span><strong>Fragmented Extension Workers:</strong> Agronomists are scarce; farmers need 24/7 localized, offline-resilient guidance.</li>
                </ul>
            </div>
            <div class="card emerald" style="flex: 1;">
                <div class="card-title green">💡 Our Solution: The Dual-Engine Architecture</div>
                <ul class="bullet-list">
                    <li><span class="dot green"></span><strong>Engine 1 (Expert System):</strong> 100% deterministic, mathematically verified clinical disease diagnosis with zero hallucination risk.</li>
                    <li><span class="dot green"></span><strong>Engine 2 (Fine-Tuned AI Agent):</strong> Empathetic, conversational assistant (AGY V2.0.0) trained specifically on agricultural instructions in Khmer & English.</li>
                    <li><span class="dot green"></span><strong>Symbiotic Grounding:</strong> The AI Agent communicates with farmers naturally while deferring all clinical diagnosis to the authoritative Rule Base.</li>
                </ul>
            </div>
        </div>

        <div class="col-half">
            <div class="card" style="flex: 1;">
                <div class="card-title cyan">📊 Key Project Milestones & Production Achievements</div>
                <div class="metric-row" style="margin-bottom: 12px;">
                    <div class="metric-box">
                        <div class="metric-val">8</div>
                        <div class="metric-label">Staple Crops Profiled</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-val green">126</div>
                        <div class="metric-label">Clinically Profiled Diseases</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-val amber">2,937</div>
                        <div class="metric-label">SFT Training Records</div>
                    </div>
                </div>
                <ul class="bullet-list">
                    <li><span class="dot"></span><strong>8 Staple Crops Covered:</strong> Rice, Cassava, Banana, Corn, Potato, Tomato, Cucumber, Chili Pepper.</li>
                    <li><span class="dot"></span><strong>Bilingual Localization:</strong> Full English and Khmer script with lunar calendar coordination.</li>
                    <li><span class="dot"></span><strong>Zero Operating Cloud Cost:</strong> Open-Meteo free API + Serverless Hugging Face Space.</li>
                    <li><span class="dot"></span><strong>Offline Resilience:</strong> Local database fallback guarantees answers even when disconnected.</li>
                </ul>
            </div>
        </div>
    </div>

    <div class="speaker-notes">
        <div class="speaker-label">🎤 Presenter Talking Point:</div>
        <div class="speaker-text">
            "Manager, rural farmers face massive crop losses but cannot safely use generic AI because it hallucinates chemical doses. We solved this with a Dual-Engine approach: a mathematically proven Expert System for clinical diagnoses, paired with a custom-trained bilingual AI Agent that talks to farmers in authentic Khmer."
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 3: SYSTEM ARCHITECTURE OVERVIEW -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge">End-to-End System Design</span>
                <span class="project-subtitle">Full-Stack Data Flow</span>
            </div>
            <div class="slide-title">System Architecture: <span>The Dual-Engine Framework</span></div>
        </div>
        <div class="slide-num">03 / 12</div>
    </div>

    <div class="slide-body" style="flex-direction: column; gap: 12px;">
        <div class="card" style="padding: 14px;">
            <div class="card-title cyan" style="margin-bottom: 10px;">🏗️ Decoupled Multi-Tier System Topology</div>
            <div class="arch-grid">
                <div class="arch-node">
                    <div class="tag-badge" style="width: fit-content; margin-bottom: 2px;">Tier 1: Client UI</div>
                    <div class="arch-title">Farmer & Expert Portal</div>
                    <div class="arch-desc">• React 18 + Vite Diagnosis Wizard<br>• Adaptive 5-7 question stepper<br>• Farmer Dashboard & Weather UI<br>• Expert & Admin Rule Editor</div>
                </div>
                <div class="arch-node green">
                    <div class="tag-badge" style="width: fit-content; margin-bottom: 2px; background: rgba(52,211,153,0.15); border-color: rgba(52,211,153,0.4); color: #34d399;">Tier 2: Core Backend</div>
                    <div class="arch-title">Flask Application Gateway</div>
                    <div class="arch-desc">• 3-Tier RBAC & WebAuthn Passkeys<br>• Blueprint routing & i18n matrix<br>• Controlled Agent Layer (agri_agent)<br>• Caching & Audit Logging</div>
                </div>
                <div class="arch-node amber">
                    <div class="tag-badge warning" style="width: fit-content; margin-bottom: 2px;">Tier 3: Clinical KB</div>
                    <div class="arch-title">Rule Engine & DB</div>
                    <div class="arch-desc">• PostgreSQL 15 (SQLAlchemy 2.0)<br>• Forward-chaining scoring algorithm<br>• 126 Diseases & 250+ Rules<br>• Evidence generation & audit trail</div>
                </div>
                <div class="arch-node purple">
                    <div class="tag-badge ai" style="width: fit-content; margin-bottom: 2px;">Tier 4: Remote AI</div>
                    <div class="arch-title">AGY V2.0.0 AI Model</div>
                    <div class="arch-desc">• Hugging Face Space (Gradio API)<br>• Qwen2.5-3B + Fine-tuned LoRA<br>• Decoupled inference over HTTPS<br>• Zero GPU burden on web host</div>
                </div>
            </div>
        </div>

        <div class="card highlight" style="padding: 12px 18px;">
            <div class="card-title cyan" style="margin-bottom: 8px;">🔄 End-to-End Execution Sequence: From Farmer Question to Verified Solution</div>
            <div class="flow-sequence">
                <div class="flow-step">
                    <strong>1. Farmer Request</strong>
                    User inputs symptoms via Wizard or asks in Khmer Chat.
                </div>
                <div class="flow-arrow">&rarr;</div>
                <div class="flow-step">
                    <strong>2. Intent Routing</strong>
                    <code style="color:#38bdf8;">agri_agent</code> detects intent & binds safe trusted tools.
                </div>
                <div class="flow-arrow">&rarr;</div>
                <div class="flow-step">
                    <strong>3. Data Retrieval</strong>
                    Pulls live weather & verified DB disease rules.
                </div>
                <div class="flow-arrow">&rarr;</div>
                <div class="flow-step">
                    <strong>4. Rule Engine</strong>
                    Calculates Coverage, Precision & Penalty mathematically.
                </div>
                <div class="flow-arrow">&rarr;</div>
                <div class="flow-step">
                    <strong>5. Model Synthesis</strong>
                    AGY V2.0.0 explains results conversationally in Khmer.
                </div>
            </div>
        </div>
    </div>

    <div class="speaker-notes">
        <div class="speaker-label">🎤 Presenter Talking Point:</div>
        <div class="speaker-text">
            "Notice our architectural separation: the web server never hosts the 3B parameter model directly. The AI runs independently on Hugging Face infrastructure, while our Flask server executes deterministic Python rule matching locally. This makes our backend fast, lightweight, and ultra-reliable."
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 4: EXPERT SYSTEM KNOWLEDGE BASE SCHEMA -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge warning">Core Knowledge Base</span>
                <span class="project-subtitle">Relational Knowledge Engineering</span>
            </div>
            <div class="slide-title">Expert System Knowledge Base: <span class="amber">Schema & Ontology</span></div>
        </div>
        <div class="slide-num">04 / 12</div>
    </div>

    <div class="slide-body">
        <div class="col-half">
            <div class="card amber" style="flex: 1;">
                <div class="card-title amber">🧠 Relational Knowledge Graph Entities</div>
                <ul class="bullet-list">
                    <li><span class="dot amber"></span><strong>crops:</strong> Master agricultural crop entity (Rice, Tomato, etc.) storing botanical metadata and Khmer translations (<code style="color:#38bdf8;">name_kh</code>).</li>
                    <li><span class="dot amber"></span><strong>diseases:</strong> 126 diseases linked to crops. Stores agricultural category, severity level (<code style="color:#fbbf24;">high, critical, medium</code>), cause explanation, clinical treatment, and prevention tips.</li>
                    <li><span class="dot amber"></span><strong>symptoms:</strong> Normalized physical observations with exact Khmer script descriptions (e.g. "ស្លឹកមានចំណុចរាងពេជ្រ", "ទឹករំអិលបាក់តេរី").</li>
                    <li><span class="dot amber"></span><strong>rules:</strong> Diagnostic rule records linked to diseases with an expert-assigned confidence baseline (0.0 to 1.0).</li>
                    <li><span class="dot amber"></span><strong>rule_symptoms:</strong> Many-to-Many junction table mapping precise symptom constellations to active rules.</li>
                    <li><span class="dot amber"></span><strong>expert_diagnoses:</strong> Audit history storing farmer answers, confirmed & denied symptoms, and helpfulness feedback.</li>
                </ul>
            </div>
        </div>

        <div class="col-half">
            <div class="card highlight" style="flex: 1;">
                <div class="card-title cyan">🌾 Agronomic Coverage: 8 Staple Cambodian Crops</div>
                <table class="slide-table">
                    <thead>
                        <tr>
                            <th>Crop</th>
                            <th>Sample High-Impact Diseases</th>
                            <th>Pathogen Classes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong style="color:#f8fafc;">🌾 Rice</strong></td>
                            <td>Blast, Sheath Blight, Bacterial Leaf Blight, Brown Planthopper</td>
                            <td>Fungal (55), Pest (32)</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">🥔 Potato</strong></td>
                            <td>Late Blight, Early Blight, Common Scab, Potato Aphids</td>
                            <td>Fungal, Bacterial</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">🍅 Tomato</strong></td>
                            <td>Late Blight, Bacterial Canker, Tomato Mosaic Virus</td>
                            <td>Viral (13), Bacterial (15)</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">🥒 Cucumber</strong></td>
                            <td>Downy Mildew, Powdery Mildew, Mosaic Virus</td>
                            <td>Fungal, Viral</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">🌶️ Chili</strong></td>
                            <td>Anthracnose, Bacterial Wilt, Chili Leaf Curl Virus</td>
                            <td>Fungal, Viral</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">🍌 Banana</strong></td>
                            <td>Panama Disease, Sigatoka, Banana Bunchy Top Virus</td>
                            <td>Fungal, Viral</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">🌽 Corn</strong></td>
                            <td>Northern Corn Leaf Blight, Common Smut, Dwarf Mosaic</td>
                            <td>Fungal, Nutrient (11)</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">🍠 Cassava</strong></td>
                            <td>Cassava Mosaic Disease, Brown Streak, Bacterial Blight</td>
                            <td>Viral, Bacterial</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="speaker-notes amber-border">
        <div class="speaker-label amber">🎤 Presenter Talking Point:</div>
        <div class="speaker-text">
            "Here is the database schema driving our expert system. We didn't just store simple text; we modeled 126 clinical diseases across 8 essential Cambodian crops with verified symptoms in English and Khmer. Agronomists can adjust rules via the admin panel without touching any code."
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 5: EXPERT SYSTEM SCORING ALGORITHM -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge warning">Clinical Inference</span>
                <span class="project-subtitle">Rule Engine Mathematical Foundation</span>
            </div>
            <div class="slide-title">Expert System Inference: <span class="amber">Scoring Algorithm & Explainability</span></div>
        </div>
        <div class="slide-num">05 / 12</div>
    </div>

    <div class="slide-body">
        <div class="col-half">
            <div class="card amber" style="flex: 1;">
                <div class="card-title amber">📐 The Mathematical Scoring Formulation</div>
                <div class="formula-box">
                    Score = (<span class="hl-var">0.60 &times; Coverage</span>) + (<span class="hl-var">0.20 &times; Precision</span>) + (<span class="hl-var">0.20 &times; Conf</span>)<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="hl-pen">- (0.45 &times; Contradiction_Penalty)</span> &plusmn; <span class="hl-op">Category_Adj</span>
                </div>
                <ul class="bullet-list" style="margin-top: 8px;">
                    <li><span class="dot amber"></span><strong>Coverage (60%):</strong> <code style="color:#38bdf8;">Matched / Rule_Symptoms</code> — How complete are the observed symptoms?</li>
                    <li><span class="dot amber"></span><strong>Precision (20%):</strong> <code style="color:#38bdf8;">Matched / Farmer_Positive</code> — Penalizes vague, scattershot symptom selections.</li>
                    <li><span class="dot amber"></span><strong>Expert Baseline (20%):</strong> Clinically verified baseline rule confidence.</li>
                    <li><span class="dot amber"></span><strong>Contradiction Penalty (-45%):</strong> <code style="color:#fbbf24;">Denied / Rule_Symptoms</code> — Heavily suppresses false positives!</li>
                    <li><span class="dot amber"></span><strong>Category Alignment:</strong> &plusmn;0.08 adjustment if category aligns with fungal/bacterial/pest.</li>
                </ul>
            </div>
        </div>

        <div class="col-half">
            <div class="card highlight" style="flex: 1;">
                <div class="card-title cyan">⚡ Adaptive Wizard & Confidence Tiers</div>
                <table class="slide-table" style="margin-bottom: 10px;">
                    <thead>
                        <tr>
                            <th>Tier Level</th>
                            <th>Threshold</th>
                            <th>Action & Clinical Recommendation</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong style="color:#34d399;">High Confidence</strong></td>
                            <td>&ge; 75%</td>
                            <td>Immediate targeted treatment & verified fungicide prescription</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#38bdf8;">Medium Confidence</strong></td>
                            <td>55% – 74%</td>
                            <td>Probable diagnosis; monitor secondary indicators</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#fbbf24;">Low Confidence</strong></td>
                            <td>35% – 54%</td>
                            <td>Suggest field extension officer review</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f43f5e;">Insufficient</strong></td>
                            <td>&lt; 35%</td>
                            <td>No definitive match; advice general field sanitation</td>
                        </tr>
                    </tbody>
                </table>
                <div style="padding: 10px 14px; background: rgba(15,23,42,0.95); border-radius: 8px; border: 1px solid rgba(71,85,105,0.4); font-size: 12px; color: #cbd5e1; line-height: 1.4;">
                    <strong style="color: #34d399;">🩺 Explainable Evidence Output (Transparent AI):</strong><br>
                    • <strong>Evidence:</strong> Matched: Diamond spots (75% Cov) | Contradicted: No bacterial ooze<br>
                    • <strong>Diagnosis:</strong> Rice Blast (89.2% High Tier) | <strong>Treatment:</strong> Tricyclazole 2g/L
                </div>
            </div>
        </div>
    </div>

    <div class="speaker-notes amber-border">
        <div class="speaker-label amber">🎤 Presenter Talking Point:</div>
        <div class="speaker-text">
            "Manager, pay special attention to our Contradiction Penalty. If a farmer denies having 'bacterial ooze', the system slashes 45% off Bacterial Blight. This guarantees high precision. And because the result prints the exact matched and missing symptoms, farmers and experts see the full mathematical reasoning."
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 6: THE AI AGENT ARCHITECTURE -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge ai">Agentic AI Architecture</span>
                <span class="project-subtitle">Controlled AI Orchestration</span>
            </div>
            <div class="slide-title">The AI Agent: <span>Deterministic Routing & Tool Gating</span></div>
        </div>
        <div class="slide-num">06 / 12</div>
    </div>

    <div class="slide-body">
        <div class="col-half">
            <div class="card highlight" style="flex: 1;">
                <div class="card-title cyan">🤖 Controlled Agent Layer (app/services/agri_agent.py)</div>
                <p style="font-size: 13px; color: #94a3b8; margin-bottom: 8px;">
                    Raw LLMs cannot be trusted with autonomous execution. Our agent layer classifies intent <strong>before</strong> the model is ever called.
                </p>
                <table class="slide-table">
                    <thead>
                        <tr>
                            <th>Farmer Intent</th>
                            <th>Detected Signals (EN / KM)</th>
                            <th>Bound Tool Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code style="color:#38bdf8;">weather_advice</code></td>
                            <td>weather, rain, ភ្លៀង, អាកាសធាតុ</td>
                            <td>Calls Open-Meteo tool</td>
                        </tr>
                        <tr>
                            <td><code style="color:#34d399;">crop_health</code></td>
                            <td>spots, rot, ជំងឺ, សត្វល្អិត</td>
                            <td>Fetches DB knowledge base</td>
                        </tr>
                        <tr>
                            <td><code style="color:#fbbf24;">agri_insights</code></td>
                            <td>soil pH, NPK, yield, ទិន្នផល</td>
                            <td>Agronomic data synthesis</td>
                        </tr>
                        <tr>
                            <td><code style="color:#a855f7;">agent_identity</code></td>
                            <td>who are you, តើអ្នកជាអ្នកណា</td>
                            <td>Asserts AGY V2.0.0 identity</td>
                        </tr>
                        <tr>
                            <td><code style="color:#ec4899;">casual_chat</code></td>
                            <td>hello, tired, នឿយហត់, អរគុណ</td>
                            <td>Empathetic conversation</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="col-half">
            <div class="card emerald" style="flex: 1;">
                <div class="card-title green">🛡️ Trusted Application Tools & Strict Guardrails</div>
                <ul class="bullet-list">
                    <li><span class="dot green"></span><strong>Knowledge-Base Tool:</strong> Reads verified disease causes, symptoms, and treatments directly from PostgreSQL. Model cannot hallucinate medications.</li>
                    <li><span class="dot green"></span><strong>Weather Intelligence Tool:</strong> Fetches live coordinates, 24h rain projections, and computes pesticide spray safety window (&lt;25 km/h).</li>
                    <li><span class="dot green"></span><strong>Diagnosis Guidance Tool:</strong> When medical diagnosis is requested, agent provides context and directly links the farmer to the Rule-Based Wizard.</li>
                    <li><span class="dot green"></span><strong>Confirmation Gate:</strong> Model cannot alter database rows, create alarms, or change settings without explicit confirmation.</li>
                    <li><span class="dot green"></span><strong>Vision Fallback Guard:</strong> When an image is attached, model explicitly refuses to invent visual claims if vision inference is inactive.</li>
                </ul>
            </div>
        </div>
    </div>

    <div class="speaker-notes">
        <div class="speaker-label">🎤 Presenter Talking Point:</div>
        <div class="speaker-text">
            "In enterprise software, you never give an LLM direct database write access or allow it to pick arbitrary functions. In our agri_agent service, the intent is determined deterministically in Python first, and safe verified tool data is injected into the context before the model formulates its answer."
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 7: AI TRAIN - DATASET ENGINEERING -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge ai">AI Train Pipeline</span>
                <span class="project-subtitle">Data Engineering & SFT Dataset</span>
            </div>
            <div class="slide-title">AI Training (AI Train): <span>Dataset Engineering & Curation</span></div>
        </div>
        <div class="slide-num">07 / 12</div>
    </div>

    <div class="slide-body">
        <div class="col-half">
            <div class="card" style="flex: 1;">
                <div class="card-title cyan">📦 Automated Knowledge Extraction (export_to_jsonl.py)</div>
                <div class="metric-row" style="margin-bottom: 10px;">
                    <div class="metric-box">
                        <div class="metric-val">2,937</div>
                        <div class="metric-label">Total Verified Pairs</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-val green">2,343</div>
                        <div class="metric-label">Training Records (80%)</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-val amber">594</div>
                        <div class="metric-label">Validation Records (20%)</div>
                    </div>
                </div>
                <ul class="bullet-list">
                    <li><span class="dot"></span><strong>Zero Overlap:</strong> Cryptographic SHA-256 fingerprinting guarantees 0% data leakage between train and validation sets.</li>
                    <li><span class="dot"></span><strong>Strict ChatML Schema:</strong> Standard multi-turn format: <code style="color:#38bdf8;">{"messages": [system, user, assistant]}</code>.</li>
                    <li><span class="dot"></span><strong>Sanitization Pipeline:</strong> Automatically strips passwords, private chats, audit records, and API tokens.</li>
                </ul>
            </div>
        </div>

        <div class="col-half">
            <div class="card highlight" style="flex: 1;">
                <div class="card-title green">📂 Instruction-Tuning Distribution by Category</div>
                <table class="slide-table">
                    <thead>
                        <tr>
                            <th>Dataset Category</th>
                            <th>Count</th>
                            <th>Objective & Skill Learned</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong style="color:#f8fafc;">Disease Pathology & Care</strong></td>
                            <td>2,520</td>
                            <td>Mastering causes, symptoms, and organic/chemical treatments</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Diagnostic Scenarios</strong></td>
                            <td>252</td>
                            <td>Multi-symptom differential diagnosis and rule logic</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Crop Diseases Overview</strong></td>
                            <td>48</td>
                            <td>Holistic crop pathology knowledge (e.g. all Rice diseases)</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">AI Identity & Provenance</strong></td>
                            <td>31</td>
                            <td>Recognizing model AGY V2.0.0 & creator Mao Seavik</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Casual & Farmer Empathy</strong></td>
                            <td>30</td>
                            <td>Handling fatigue, encouragement, rural conversational warmth</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Greetings & Etiquette</strong></td>
                            <td>24</td>
                            <td>Authentic polite Khmer greetings (សួស្តី, ជំរាបសួរ)</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Agricultural Insights</strong></td>
                            <td>16</td>
                            <td>Soil pH balancing, N-P-K ratios, drip irrigation, rotation</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="speaker-notes">
        <div class="speaker-label">🎤 Presenter Talking Point:</div>
        <div class="speaker-text">
            "To train our model, we didn't just scrape random web articles. We engineered an automated extraction script that converted our 126 clinical database diseases into 2,937 high-quality conversational training records. It includes technical pathology, soil chemistry, and empathetic farmer communication."
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 8: QLORA FINE-TUNING & MODEL SPECS -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge ai">AI Train Pipeline</span>
                <span class="project-subtitle">QLoRA Fine-Tuning Execution</span>
            </div>
            <div class="slide-title">AI Fine-Tuning: <span>Qwen2.5-3B Architecture & QLoRA</span></div>
        </div>
        <div class="slide-num">08 / 12</div>
    </div>

    <div class="slide-body">
        <div class="col-half">
            <div class="card highlight" style="flex: 1;">
                <div class="card-title cyan">🧠 Base Model: Qwen/Qwen2.5-3B-Instruct</div>
                <ul class="bullet-list">
                    <li><span class="dot"></span><strong>State-of-the-Art Architecture:</strong> Qwen 2.5 is renowned for superior multilingual capabilities, specifically rich Unicode Khmer vocabulary representation.</li>
                    <li><span class="dot"></span><strong>3 Billion Parameters:</strong> The ideal sweet spot between high-level reasoning and ultra-fast, low-latency edge inference.</li>
                    <li><span class="dot"></span><strong>Memory-Efficient QLoRA:</strong> 4-Bit NormalFloat (NF4) base quantization with double quantization reduces memory footprint to under 6 GB VRAM!</li>
                </ul>
                <div class="code-box" style="margin-top: 10px;">
                    quantization_config = BitsAndBytesConfig(<br>
                    &nbsp;&nbsp;load_in_4bit=True, bnb_4bit_quant_type="nf4",<br>
                    &nbsp;&nbsp;bnb_4bit_compute_dtype=torch.float16,<br>
                    &nbsp;&nbsp;bnb_4bit_use_double_quant=True<br>
                    )
                </div>
            </div>
        </div>

        <div class="col-half">
            <div class="card emerald" style="flex: 1;">
                <div class="card-title green">⚙️ LoRA Hyperparameters & Training Specs</div>
                <table class="slide-table">
                    <thead>
                        <tr>
                            <th>Parameter</th>
                            <th>Value</th>
                            <th>Technical Rationale</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong style="color:#f8fafc;">LoRA Rank (r)</strong></td>
                            <td><code style="color:#34d399;">32</code></td>
                            <td>High adapter capacity for dual-language domain knowledge</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">LoRA Alpha (&alpha;)</strong></td>
                            <td><code style="color:#34d399;">64</code></td>
                            <td>Standard 2:1 scaling factor for stable gradient updates</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Target Modules</strong></td>
                            <td>All 7 Projections</td>
                            <td><code style="color:#38bdf8;">q, k, v, o, gate, up, down_proj</code> for deep adaptation</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Training Epochs</strong></td>
                            <td><code style="color:#34d399;">4 Epochs</code></td>
                            <td>Optimal convergence without catastrophic forgetting</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Batch Size</strong></td>
                            <td><code style="color:#34d399;">2 &times; 4 Accum = 8</code></td>
                            <td>Effective batch size 8 ensures smooth gradient descent</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Learning Rate</strong></td>
                            <td><code style="color:#34d399;">1.5e-4 (Cosine)</code></td>
                            <td>Smooth learning rate decay with 6% warmup steps</td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Training Time</strong></td>
                            <td>28 min (Colab T4)</td>
                            <td>Fast, repeatable fine-tuning on free Google Colab GPU</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="speaker-notes">
        <div class="speaker-label">🎤 Presenter Talking Point:</div>
        <div class="speaker-text">
            "We used QLoRA on Qwen2.5-3B. By quantizing the base model to 4-bit and fine-tuning all 7 projection matrices with rank 32, we adapted the model specifically to Cambodian agriculture in under 30 minutes on a standard GPU, saving tens of thousands in training costs."
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 9: MODEL SERVING & DEPLOYMENT -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge ai">Serving Infrastructure</span>
                <span class="project-subtitle">Production Serving & Fallback</span>
            </div>
            <div class="slide-title">Model Serving: <span>Hugging Face Space & Offline Fallback</span></div>
        </div>
        <div class="slide-num">09 / 12</div>
    </div>

    <div class="slide-body">
        <div class="col-half">
            <div class="card highlight" style="flex: 1;">
                <div class="card-title cyan">☁️ Production Deployment: Serverless Hugging Face Space</div>
                <ul class="bullet-list">
                    <li><span class="dot"></span><strong>Trained Adapter Hub:</strong> Uploaded directly to Hugging Face Hub at <code style="color:#38bdf8;">Maoseavik/agri-qwen3b-lora</code> (<code style="color:#cbd5e1;">adapter_model.safetensors</code> & <code style="color:#cbd5e1;">adapter_config.json</code>).</li>
                    <li><span class="dot"></span><strong>Inference API Endpoint:</strong> Hosted on Hugging Face Space: <code style="color:#38bdf8;">Maoseavik/agrisystem-agricultural-assistant</code> running Gradio 5.50 & FastAPI.</li>
                    <li><span class="dot"></span><strong>Decoupled Web Server:</strong> The Flask web server runs anywhere (Railway, Docker, local machine) and connects over HTTPS. Zero GPU cost on the primary web server!</li>
                    <li><span class="dot"></span><strong>Sanitized Output:</strong> Automatic response cleanser removes markdown headers, asterisks, and emojis for clean, professional reading.</li>
                </ul>
            </div>
        </div>

        <div class="col-half">
            <div class="card emerald" style="flex: 1;">
                <div class="card-title green">🛡️ High-Availability Local Agronomic Fallback</div>
                <p style="font-size: 13px; color: #94a3b8; margin-bottom: 10px;">
                    What happens if the Hugging Face Space is sleeping or the cloud connection drops?
                </p>
                <div style="background: rgba(15,23,42,0.95); border: 1px solid rgba(52,211,153,0.45); border-radius: 8px; padding: 14px; font-size: 13px; line-height: 1.45; color: #cbd5e1;">
                    <strong style="color: #34d399;">Automatic Local Failover (ai_expert_service.py):</strong><br>
                    If the remote AI endpoint fails or times out (30s), the system seamlessly synthesizes a complete, grammatically smooth response using local database knowledge without crashing or throwing error screens.<br><br>
                    <span style="color:#38bdf8;">✔ 100% Uptime Guarantee</span> for farmers in rural areas with spotty internet.
                </div>
            </div>
        </div>
    </div>

    <div class="speaker-notes">
        <div class="speaker-label">🎤 Presenter Talking Point:</div>
        <div class="speaker-text">
            "Our model is hosted as a dedicated Hugging Face Space called 'agrisystem-agricultural-assistant'. Even better: if the cloud connection ever drops, our backend automatically activates an offline agronomic fallback engine. The farmer never experiences a service outage."
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 10: HYBRID SYNERGY COMPARISON -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge">Comparative Analysis</span>
                <span class="project-subtitle">Expert System vs. AI Agent</span>
            </div>
            <div class="slide-title">The Hybrid Advantage: <span>Expert System vs. AI Agent</span></div>
        </div>
        <div class="slide-num">10 / 12</div>
    </div>

    <div class="slide-body">
        <div class="col-1">
            <div class="card" style="padding: 12px 18px;">
                <table class="slide-table" style="font-size: 13px;">
                    <thead>
                        <tr>
                            <th style="width: 17%;">Dimension</th>
                            <th style="width: 27%;">1. Expert System Knowledge Base</th>
                            <th style="width: 27%;">2. Fine-Tuned AI Agent (AGY V2)</th>
                            <th style="width: 29%; color: #34d399;">⭐ The Combined Hybrid Solution</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong style="color:#f8fafc;">Primary Role</strong></td>
                            <td>Authoritative Clinical Diagnosis & Chemical Prescription</td>
                            <td>Conversational Assistant, Field Advice & Explanation</td>
                            <td><strong style="color:#34d399;">End-to-End Companion: Guided Diagnosis + Conversational Care</strong></td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Core Engine</strong></td>
                            <td>PostgreSQL Database + Forward Chaining Rule Scoring</td>
                            <td>Fine-Tuned Qwen2.5-3B QLoRA Neural Network</td>
                            <td><strong style="color:#34d399;">Deterministic Rules bound to Natural Language LLM</strong></td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Hallucination Risk</strong></td>
                            <td><span style="color:#34d399; font-weight: bold;">0.0% (Mathematically Impossible)</span></td>
                            <td>Low (Constrained by SFT domain data)</td>
                            <td><strong style="color:#34d399;">Zero Clinical Hallucination (Guarded by Tool Gating)</strong></td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Farmer Interaction</strong></td>
                            <td>Structured Step-by-Step Yes/No/Skip Wizard</td>
                            <td>Natural Free-Text Chat in English or Khmer</td>
                            <td><strong style="color:#34d399;">Low-literacy wizard for diagnosis; chat for quick questions</strong></td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Explainability</strong></td>
                            <td>100% Mathematical Evidence (Matched, Missing, Ratio)</td>
                            <td>Semantic explanations in natural prose</td>
                            <td><strong style="color:#34d399;">Complete audit trail backed by warm human-like explanation</strong></td>
                        </tr>
                        <tr>
                            <td><strong style="color:#f8fafc;">Live Context</strong></td>
                            <td>Static agronomic database records</td>
                            <td>Model memory & prompt context</td>
                            <td><strong style="color:#34d399;">Dynamic integration with live Open-Meteo weather</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="card emerald" style="padding: 10px 18px;">
                <div style="font-size: 13px; color: #e2e8f0; line-height: 1.4;">
                    <strong style="color: #34d399;">🏆 Executive Takeaway for Management:</strong>
                    Pure LLMs cannot be trusted with lethal chemicals; pure rule engines are too rigid for uneducated farmers. Combining both gives mathematical certainty + conversational warmth.
                </div>
            </div>
        </div>
    </div>

    <div class="speaker-notes">
        <div class="speaker-label">🎤 Presenter Talking Point:</div>
        <div class="speaker-text">
            "Manager, this table represents our biggest innovation. Pure AI is too unpredictable for chemical prescriptions, but pure expert systems feel too rigid for uneducated farmers. By combining them, we get mathematical precision where safety matters, and conversational empathy where user experience matters."
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 11: INTEGRATED AUXILIARY SERVICES -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge">Extended Capabilities</span>
                <span class="project-subtitle">Weather, Culture & Enterprise Security</span>
            </div>
            <div class="slide-title">Value-Added Modules: <span>Weather, Localization & Security</span></div>
        </div>
        <div class="slide-num">11 / 12</div>
    </div>

    <div class="slide-body">
        <div class="col-third">
            <div class="card highlight" style="flex: 1;">
                <div class="card-title cyan">☀️ Weather Intelligence</div>
                <ul class="bullet-list">
                    <li><span class="dot"></span><strong>Zero-Cost Coordinate API:</strong> Real-time Open-Meteo integration without API keys.</li>
                    <li><span class="dot"></span><strong>Storm Warning:</strong> Wind &gt;45 km/h triggers immediate harvest protection.</li>
                    <li><span class="dot"></span><strong>Heavy Rain:</strong> &gt;35 mm triggers waterlogging & drainage warnings.</li>
                    <li><span class="dot"></span><strong>Heatwave Alert:</strong> &gt;38&deg;C triggers shade & hydration advice.</li>
                    <li><span class="dot"></span><strong>Safe Spray Window:</strong> Flags if wind &gt;25 km/h causes pesticide drift.</li>
                </ul>
            </div>
        </div>

        <div class="col-third">
            <div class="card emerald" style="flex: 1;">
                <div class="card-title green">🎨 Khmer Cultural Engine</div>
                <ul class="bullet-list">
                    <li><span class="dot green"></span><strong>Cambodian Seasons:</strong> Dynamically adapts UI for Dry Season (រដូវប្រាំង) & Rainy Season (រដូវវស្សា).</li>
                    <li><span class="dot green"></span><strong>Lunar Calendar:</strong> Uses <code style="color:#34d399;">khmerdate</code> to convert dates to Khmer lunar coordinates and festivals (Pchum Ben, Khmer New Year).</li>
                    <li><span class="dot green"></span><strong>Khmer Typography:</strong> Hand-crafted Unicode normalizers ensure seamless Khmer text display.</li>
                </ul>
            </div>
        </div>

        <div class="col-third">
            <div class="card" style="flex: 1;">
                <div class="card-title amber">🔒 Enterprise Security & RBAC</div>
                <ul class="bullet-list">
                    <li><span class="dot amber"></span><strong>3 User Tiers:</strong> Farmer (diagnose), Expert (curate rules), Admin (auditing).</li>
                    <li><span class="dot amber"></span><strong>Passwordless Passkeys:</strong> WebAuthn FIDO2 biometric authentication alongside Google OAuth.</li>
                    <li><span class="dot amber"></span><strong>Full Audit Trail:</strong> Logs every rule edit, disease update, and farmer diagnosis for accountability.</li>
                </ul>
            </div>
        </div>
    </div>

    <div class="speaker-notes">
        <div class="speaker-label">🎤 Presenter Talking Point:</div>
        <div class="speaker-text">
            "Beyond diagnosis, we built practical farm intelligence: our weather engine tells farmers when high winds will blow away expensive pesticide sprays, our cultural engine synchronizes with the Khmer lunar calendar, and enterprise WebAuthn passkeys keep farmer accounts secure."
        </div>
    </div>
</div>

<!-- ========================================== -->
<!-- SLIDE 12: MANAGER BRIEFING & DEMO STRATEGY -->
<!-- ========================================== -->
<div class="slide">
    <div class="slide-header">
        <div class="header-left">
            <div class="badge-row">
                <span class="tag-badge green">Demo & Action Plan</span>
                <span class="project-subtitle">Executive Takeaways & Live Demo</span>
            </div>
            <div class="slide-title">Executive Briefing: <span class="green">Live Demo Sequence & Q&A Defense</span></div>
        </div>
        <div class="slide-num">12 / 12</div>
    </div>

    <div class="slide-body">
        <div class="col-half">
            <div class="card emerald" style="flex: 1;">
                <div class="card-title green">🎯 Step-by-Step Live Demo Script for Your Manager</div>
                <ul class="bullet-list">
                    <li><span class="dot green"></span><strong>Demo Step 1 (Expert Wizard):</strong> Open React Diagnosis Wizard &rarr; Select <em>Rice</em> &rarr; Check "Diamond-shaped spots" &rarr; Show 3 adaptive clarification questions &rarr; Reveal 92% Rice Blast diagnosis with clinical evidence and chemical treatment.</li>
                    <li><span class="dot green"></span><strong>Demo Step 2 (AI Agent Chat):</strong> Type in Khmer: <em style="color:#38bdf8;">"ស្រូវរបស់ខ្ញុំកើតជំងឺប្លាស តើត្រូវព្យាបាលយ៉ាងណា?"</em> &rarr; Show instant, fluent Khmer reply grounded in verified agronomic science.</li>
                    <li><span class="dot green"></span><strong>Demo Step 3 (Weather Grounding):</strong> Ask: <em>"Can I spray pesticide today?"</em> &rarr; Agent checks local wind speed via Open-Meteo and gives a safe spray decision.</li>
                    <li><span class="dot green"></span><strong>Demo Step 4 (AI Identity):</strong> Ask: <em>"Who created you?"</em> &rarr; Model answers proudly as AgriSystem AI (AGY V2.0.0, Team Leader Mao Seavik).</li>
                </ul>
            </div>
        </div>

        <div class="col-half">
            <div class="card highlight" style="flex: 1;">
                <div class="card-title cyan">🛡️ Manager Q&A Defense: Ready Answers</div>
                <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; line-height: 1.4;">
                    <div style="background: rgba(15,23,42,0.9); padding: 10px 14px; border-radius: 8px;">
                        <strong style="color: #38bdf8;">Q: "Why didn't we just call the OpenAI ChatGPT API?"</strong><br>
                        <span style="color: #cbd5e1;">A: ChatGPT costs recurring subscription dollars, sends agricultural data outside the country, hallucinates chemical mixtures, and lacks deep knowledge of Cambodian crop pathology. Our solution is private, free to run, and specialized.</span>
                    </div>
                    <div style="background: rgba(15,23,42,0.9); padding: 10px 14px; border-radius: 8px;">
                        <strong style="color: #34d399;">Q: "What if the AI makes a mistake that damages a farm?"</strong><br>
                        <span style="color: #cbd5e1;">A: It cannot. The AI agent is strictly bounded. All disease diagnosis is calculated by our mathematical Rule Engine which outputs the exact matched symptoms and references.</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="speaker-notes green-border">
        <div class="speaker-label green">🎤 Presenter Closing Statement:</div>
        <div class="speaker-text">
            "In summary: We delivered a complete, production-ready agricultural intelligence system with 0% clinical hallucination, a custom 3B bilingual fine-tuned AI model, and full localization for Cambodia. It is robust, decoupled, and ready for deployment."
        </div>
    </div>
</div>

</body>
</html>
"""

html_path = Path("/Users/ahzarjy/Documents/Ai/Project_Assignment/scratch/presentation.html")
pdf_dest = Path("/Users/ahzarjy/Downloads/AgriSystem_Expert_System_and_AI_Agent_Presentation.pdf")

html_path.write_text(html_content, encoding="utf-8")
print(f"HTML written to {html_path}")

chrome_cmd = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_dest}",
    str(html_path),
]

print("Executing Chrome headless PDF generation...")
result = subprocess.run(chrome_cmd, capture_output=True, text=True)
print("Chrome returncode:", result.returncode)
if pdf_dest.exists():
    size_kb = pdf_dest.stat().st_size / 1024
    print(f"SUCCESS: PDF created at {pdf_dest} ({size_kb:.1f} KB)")
else:
    print("FAILED: PDF not found. Stderr:", result.stderr)

