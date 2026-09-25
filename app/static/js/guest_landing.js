/**
 * AgriSystem Guest User Landing & Interactive Workflow
 * Clean, modern SaaS interaction handlers with in-page authentication
 */
(() => {
    // -------------------------------------------------------------
    // 1. Direct Auth Navigation Helper (Simple Auth)
    // -------------------------------------------------------------
    window.openAuthDrawer = function (tab = 'login') {
        window.location.href = tab === 'signup' ? '/auth/register' : '/auth/login';
    };
    window.closeAuthDrawer = function () {};

    // -------------------------------------------------------------
    // 2. Real-Time Activity Rotating Ticker
    // -------------------------------------------------------------
    const sampleActivities = [
        { color: '#3b82f6', icon: 'fas fa-seedling', text: 'Rice Blast detected in Battambang • Treatment generated in 1.4s' },
        { color: '#0ea5e9', icon: 'fas fa-cloud-sun-rain', text: 'Rain alert delivered to 42 rice farmers in Siem Reap' },
        { color: '#8b5cf6', icon: 'fas fa-user-shield', text: 'Cassava Mosaic advisory verified by Expert Agronomist' },
        { color: '#f59e0b', icon: 'fas fa-bug', text: 'Fall Armyworm alert triggered in Kampong Cham corn plots' },
        { color: '#3b82f6', icon: 'fas fa-shield-virus', text: 'Tomato Late Blight diagnosis completed • Fungicide dosage provided' },
        { color: '#0ea5e9', icon: 'fas fa-tint', text: 'Drought advisory and irrigation schedule sent to Takeo' }
    ];

    let actIndex = 0;
    const activityContainer = document.getElementById('nxLiveActivity');

    if (activityContainer) {
        setInterval(() => {
            const itemData = sampleActivities[actIndex % sampleActivities.length];
            actIndex++;

            const el = document.createElement('div');
            el.className = 'nx-activity-item';
            el.innerHTML = `
                <span class="nx-activity-dot" style="background:${itemData.color};"></span>
                <span class="nx-activity-text"><i class="${itemData.icon} mr-1" style="color:${itemData.color};"></i>${itemData.text}</span>
                <span class="nx-activity-time">Just now</span>
            `;

            activityContainer.insertBefore(el, activityContainer.firstChild);
            if (activityContainer.children.length > 4) {
                activityContainer.removeChild(activityContainer.lastChild);
            }
        }, 4000);
    }

    // -------------------------------------------------------------
    // 3. Interactive Live AI Crop Chat Preview
    // -------------------------------------------------------------
    const chatBody = document.getElementById('nxChatBody');
    const chatInput = document.getElementById('nxChatInput');
    const chatSendBtn = document.getElementById('nxChatSendBtn');

    function appendMessage(text, role) {
        if (!chatBody) return;
        const msg = document.createElement('div');
        msg.className = `nx-cbbl ${role === 'user' ? 'nx-cbus' : 'nx-cbai'}`;
        msg.textContent = text;
        chatBody.appendChild(msg);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function appendTyping() {
        if (!chatBody) return null;
        const typing = document.createElement('div');
        typing.id = 'nxTypingIndicator';
        typing.className = 'nx-typing';
        typing.innerHTML = '<div class="nx-tdot"></div><div class="nx-tdot"></div><div class="nx-tdot"></div>';
        chatBody.appendChild(typing);
        chatBody.scrollTop = chatBody.scrollHeight;
        return typing;
    }

    function removeTyping() {
        const typing = document.getElementById('nxTypingIndicator');
        if (typing) typing.remove();
    }

    window.sendGuestChat = async function (overrideText) {
        const text = (overrideText || (chatInput ? chatInput.value : '')).trim();
        if (!text) return;

        if (chatInput) {
            chatInput.value = '';
        }

        appendMessage(text, 'user');
        if (chatSendBtn) chatSendBtn.disabled = true;

        appendTyping();

        try {
            const res = await fetch('/farmer/guest-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            removeTyping();

            if (data.reply) {
                appendMessage(data.reply, 'ai');
            } else {
                appendMessage('AgriSystem AI is ready. For detailed diagnosis and prescription, try our free instant scan tool!', 'ai');
            }
        } catch (e) {
            removeTyping();
            appendMessage('I am your AgriSystem Support Assistant. Ask me how to use the dashboard, upload photos for diagnosis, manage your account, or contact administrators!', 'ai');
        } finally {
            if (chatSendBtn) chatSendBtn.disabled = false;
        }
    };

    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', () => window.sendGuestChat());
    }

    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.sendGuestChat();
            }
        });
    }

    window.quickCropQuery = function (query) {
        window.sendGuestChat(query);
    };

    // -------------------------------------------------------------
    // 4. Sample Crop Disease Interactive Preview
    // -------------------------------------------------------------
    const sampleData = {
        rice: {
            title: "Rice Blast (Magnaporthe oryzae)",
            crop: "Rice / ស្រូវ",
            confidence: "98.4%",
            symptoms: "Diamond or spindle-shaped lesions on leaves with white-grey centres and dark brown margins.",
            remedy: "Drain excess standing water. Avoid high-nitrogen topdressing. Apply Tricyclazole 75% WP (15-20g per 16L sprayer) or Azoxystrobin early in the morning."
        },
        cassava: {
            title: "Cassava Mosaic Disease (CMD)",
            crop: "Cassava / ដំឡូងមី",
            confidence: "97.1%",
            symptoms: "Severe leaf distortion, asymmetric curling, and yellow chlorotic mosaic patches.",
            remedy: "Rogue and incinerate infected plants immediately. Control whitefly populations. Plant verified virus-resistant varieties (KU50, Rayong 72)."
        },
        corn: {
            title: "Northern Corn Leaf Blight",
            crop: "Corn / Maize / ពោត",
            confidence: "96.5%",
            symptoms: "Elongated, elliptical grey-green or tan lesions spreading along leaf veins.",
            remedy: "Rotate with non-host crops. Ensure plant spacing allows airflow. Apply Mancozeb 80% WP or Pyraclostrobin if lesions reach ear leaves."
        },
        tomato: {
            title: "Tomato Late Blight (Phytophthora infestans)",
            crop: "Tomato / ប៉េងប៉ោះ",
            confidence: "99.0%",
            symptoms: "Water-soaked dark lesions on leaf tips and white fluffy mildew on leaf undersides in humid conditions.",
            remedy: "Eliminate cull piles. Avoid overhead sprinkling. Apply Metalaxyl + Mancozeb or Copper Hydroxide spray every 7 days during humid rainy spells."
        }
    };

    window.selectSampleDisease = function (cropKey) {
        document.querySelectorAll('.nx-sample-pill, .nx-sample-card').forEach(c => c.classList.remove('active'));
        const activePill = document.querySelector(`.nx-sample-pill[data-crop="${cropKey}"], .nx-sample-card[data-crop="${cropKey}"]`);
        if (activePill) activePill.classList.add('active');

        const item = sampleData[cropKey];
        if (!item) return;

        const reportEl = document.getElementById('nxSampleReport');
        if (reportEl) {
            reportEl.innerHTML = `
                <div class="nx-report-header">
                    <div>
                        <span class="nx-report-pill">${item.crop}</span>
                        <h4 class="nx-report-title">${item.title}</h4>
                    </div>
                    <div class="nx-confidence-meter">
                        <div class="nx-conf-val">${item.confidence}</div>
                        <div class="nx-conf-bar-wrap"><div class="nx-conf-bar" style="width:${item.confidence};"></div></div>
                    </div>
                </div>
                <div class="small text-muted mb-2"><strong>Symptoms:</strong> ${item.symptoms}</div>
                <div class="nx-rx-box">
                    <div class="nx-rx-title"><i class="fas fa-prescription-bottle-alt"></i> Certified Prescription:</div>
                    <div class="small" style="color:var(--nx-text);">${item.remedy}</div>
                </div>
                <div class="mt-3 text-right">
                    <a href="/farmer/diagnose" class="nx-btn-primary" style="padding: 0.55rem 1.15rem; font-size: 0.85rem;">
                        <i class="fas fa-camera mr-1"></i> Scan Your Own Crop Image
                    </a>
                </div>
            `;
        }
    };

    // -------------------------------------------------------------
    // 5. Pricing Toggle (Monthly vs Yearly Billing)
    // -------------------------------------------------------------
    const pricingToggle = document.getElementById('nxPriceToggle');
    if (pricingToggle) {
        pricingToggle.addEventListener('change', function () {
            const isYearly = this.checked;
            const priceVal = document.getElementById('nxProPlanPrice');
            const pricePeriod = document.getElementById('nxProPlanPeriod');

            if (priceVal) {
                priceVal.textContent = isYearly ? priceVal.getAttribute('data-yearly') : priceVal.getAttribute('data-monthly');
            }
            if (pricePeriod) {
                pricePeriod.textContent = isYearly ? '/mo (billed annually)' : '/month';
            }
        });
    }

    // -------------------------------------------------------------
    // 6. 3D Interactive AI Agronomy Scanner & Perspective Tilt
    // -------------------------------------------------------------
    const scanCropData = {
        rice: {
            crop: "Oryza Sativa (Rice / ស្រូវ)",
            disease: "Rice Blast (Magnaporthe)",
            confidence: "98.4%",
            rx: "Tricyclazole 75% WP (15-20g/16L)",
            hotspot: { cx: 185, cy: 160 }
        },
        cassava: {
            crop: "Manihot Esculenta (Cassava / ដំឡូងមី)",
            disease: "Cassava Mosaic Virus (CMD)",
            confidence: "97.1%",
            rx: "Rogue infected plants + Clean stems",
            hotspot: { cx: 70, cy: 130 }
        },
        corn: {
            crop: "Zea Mays (Corn / ពោត)",
            disease: "Northern Corn Leaf Blight",
            confidence: "96.5%",
            rx: "Mancozeb 80% WP or Pyraclostrobin",
            hotspot: { cx: 155, cy: 95 }
        },
        tomato: {
            crop: "Solanum Lycopersicum (Tomato / ប៉េងប៉ោះ)",
            disease: "Tomato Late Blight (Phytophthora)",
            confidence: "99.0%",
            rx: "Metalaxyl + Mancozeb / 7-day spray",
            hotspot: { cx: 90, cy: 180 }
        }
    };

    window.trigger3DScan = function (cropKey) {
        const data = scanCropData[cropKey];
        if (!data) return;

        // Active state on pill buttons
        document.querySelectorAll('.nx-3d-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scanCrop === cropKey);
        });

        // Trigger active laser sweep burst
        const laser = document.getElementById('nx3dLaser');
        if (laser) {
            laser.classList.remove('laser-pulse');
            void laser.offsetWidth; // Trigger DOM reflow to replay animation
            laser.classList.add('laser-pulse');
        }

        // Update telemetry elements with animation
        const diagEl = document.getElementById('nx3dDiagnosisName');
        const confEl = document.getElementById('nx3dConfidenceVal');
        const cropEl = document.getElementById('nx3dTargetCrop');
        const rxEl = document.getElementById('nx3dPrescriptionText');
        const hotspot = document.getElementById('nx3dHotspot');

        if (diagEl) diagEl.textContent = data.disease;
        if (confEl) confEl.textContent = data.confidence;
        if (cropEl) cropEl.textContent = 'Crop: ' + data.crop;
        if (rxEl) rxEl.textContent = data.rx;

        if (hotspot) {
            hotspot.setAttribute('cx', data.hotspot.cx);
            hotspot.setAttribute('cy', data.hotspot.cy);
        }

        // Also synchronize sample showcase report below if function exists
        if (typeof window.selectSampleDisease === 'function') {
            window.selectSampleDisease(cropKey);
        }
    };

    window.rescan3DModel = function () {
        const activePill = document.querySelector('.nx-3d-pill-btn.active');
        const currentCrop = activePill ? activePill.dataset.scanCrop : 'rice';
        window.trigger3DScan(currentCrop);
    };

    // 3D Perspective Tilt on Mouse Movement
    const viewport = document.getElementById('nx3dViewport');
    const scene = document.getElementById('nx3dScene');

    if (viewport && scene) {
        let targetX = 12;
        let targetY = 0;
        let currentX = 12;
        let currentY = 0;
        let isHovered = false;

        const onMove = (clientX, clientY) => {
            const rect = viewport.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const normX = (clientX - rect.left) / rect.width - 0.5;
            const normY = (clientY - rect.top) / rect.height - 0.5;
            targetY = normX * 28; // -14deg to +14deg
            targetX = 12 - (normY * 22); // -10deg to +23deg
        };

        viewport.addEventListener('mousemove', (e) => {
            isHovered = true;
            onMove(e.clientX, e.clientY);
        });

        viewport.addEventListener('mouseleave', () => {
            isHovered = false;
            targetX = 12;
            targetY = 0;
        });

        viewport.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) {
                onMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

        viewport.addEventListener('touchend', () => {
            targetX = 12;
            targetY = 0;
        });

        function renderScene() {
            currentX += (targetX - currentX) * 0.1;
            currentY += (targetY - currentY) * 0.1;

            if (window.innerWidth > 991) {
                scene.style.transform = `rotateX(${currentX.toFixed(2)}deg) rotateY(${currentY.toFixed(2)}deg)`;
            } else {
                scene.style.transform = 'none';
            }
            requestAnimationFrame(renderScene);
        }
        requestAnimationFrame(renderScene);
    }

    // -------------------------------------------------------------
    // 7. Background Neural Particle Field Canvas (60 FPS Lightweight)
    // -------------------------------------------------------------
    const canvas = document.getElementById('nx3dCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width = canvas.width = canvas.offsetWidth;
        let height = canvas.height = canvas.offsetHeight;
        let animationFrameId = null;
        let isVisible = true;

        const resize = () => {
            if (!canvas) return;
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
        };

        window.addEventListener('resize', resize);

        const particleCount = 38;
        const particles = [];
        const colors = [
            'rgba(59, 130, 246, 0.65)',
            'rgba(56, 189, 248, 0.65)',
            'rgba(99, 102, 241, 0.55)',
            'rgba(245, 158, 11, 0.5)'
        ];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * (width || 800),
                y: Math.random() * (height || 400),
                vx: (Math.random() - 0.5) * 0.65,
                vy: (Math.random() - 0.5) * 0.65,
                r: Math.random() * 2 + 1.2,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }

        let mouseX = -9999;
        let mouseY = -9999;

        const container = document.getElementById('nx3DShowcase');
        if (container) {
            container.addEventListener('mousemove', (e) => {
                const rect = container.getBoundingClientRect();
                mouseX = e.clientX - rect.left;
                mouseY = e.clientY - rect.top;
            });
            container.addEventListener('mouseleave', () => {
                mouseX = -9999;
                mouseY = -9999;
            });
        }

        function drawParticles() {
            if (!isVisible || !ctx) {
                animationFrameId = requestAnimationFrame(drawParticles);
                return;
            }

            ctx.clearRect(0, 0, width, height);

            // Connect nearby particles
            for (let i = 0; i < particleCount; i++) {
                const p1 = particles[i];

                // Mouse deflection
                const dxm = p1.x - mouseX;
                const dym = p1.y - mouseY;
                const distMouse = Math.sqrt(dxm * dxm + dym * dym);
                if (distMouse < 90) {
                    const angle = Math.atan2(dym, dxm);
                    p1.x += Math.cos(angle) * 1.5;
                    p1.y += Math.sin(angle) * 1.5;
                }

                p1.x += p1.vx;
                p1.y += p1.vy;

                if (p1.x < 0) p1.x = width;
                if (p1.x > width) p1.x = 0;
                if (p1.y < 0) p1.y = height;
                if (p1.y > height) p1.y = 0;

                ctx.beginPath();
                ctx.arc(p1.x, p1.y, p1.r, 0, Math.PI * 2);
                ctx.fillStyle = p1.color;
                ctx.fill();

                for (let j = i + 1; j < particleCount; j++) {
                    const p2 = particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 95) {
                        const alpha = (1 - dist / 95) * 0.22;
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
                        ctx.lineWidth = 0.85;
                        ctx.stroke();
                    }
                }
            }

            animationFrameId = requestAnimationFrame(drawParticles);
        }

        // Pause animation when scrolled away
        if ('IntersectionObserver' in window && container) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    isVisible = entry.isIntersecting;
                });
            }, { threshold: 0.1 });
            observer.observe(container);
        }

        drawParticles();
    }
})();
