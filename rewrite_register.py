import os

register_html = """<!DOCTYPE html>
<html lang="{{ current_lang }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>{{ t("auth_create_account")|default("Create Account") }} | AGRI SYSTEM</title>
    <link rel="icon" type="image/jpeg" href="{{ url_for('static', filename='img/logo.jpg') }}">
    <link rel="shortcut icon" type="image/jpeg" href="{{ url_for('static', filename='img/logo.jpg') }}">
    <link rel="apple-touch-icon" href="{{ url_for('static', filename='img/logo.jpg') }}">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Kantumruy+Pro:wght@400;500;600;700&family=Noto+Sans+Khmer:wght@400;500;600;700&display=swap" rel="stylesheet">

    <link href="{{ url_for('static', filename='sb-admin/vendor/fontawesome-free/css/all.min.css') }}" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.0.0/css/flag-icons.min.css" rel="stylesheet">
    <link href="{{ url_for('static', filename='css/auth.css', v=static_version) }}" rel="stylesheet">
    <link href="{{ url_for('static', filename='css/neumorphic_toggle.css', v=static_version) }}" rel="stylesheet">
    <link href="{{ url_for('static', filename='css/notifications.css', v=static_version) }}" rel="stylesheet">

    <script>
    (function () {
        const storedTheme = localStorage.getItem("theme");
        if (storedTheme === "dark") {
            document.documentElement.classList.add("dark-mode", "auth-panel-dark");
        } else {
            document.documentElement.classList.remove("dark-mode", "auth-panel-dark");
        }
    })();
    </script>
</head>
<body class="auth-clean-body">

{% include "partials/flash_notices.html" %}

<div class="auth-clean-container">
    <!-- Top Utility Controls -->
    <div class="auth-clean-topbar">
        <div class="auth-lang-pills">
            <a href="{{ url_for('user.update_language', lang='en', next=request.path) }}" class="auth-lang-btn {% if current_lang == 'en' %}is-active{% endif %}">
                <span class="fi fi-us"></span> EN
            </a>
            <a href="{{ url_for('user.update_language', lang='km', next=request.path) }}" class="auth-lang-btn {% if current_lang == 'km' %}is-active{% endif %}">
                <span class="fi fi-kh"></span> KH
            </a>
        </div>
        <div class="auth-theme-pill">
            <label class="label mb-0" for="authThemeToggle" title="Toggle Light/Dark Mode">
                <div class="toggle">
                    <input class="toggle-state" type="checkbox" id="authThemeToggle" name="check" value="dark">
                    <div class="indicator"></div>
                </div>
            </label>
        </div>
    </div>

    <!-- Centered Minimalist Card -->
    <div class="auth-clean-card">
        <div class="auth-card-header">
            <div class="auth-brand-badge">
                <img src="{{ url_for('static', filename='img/logo.jpg') }}" alt="Agri System" class="auth-clean-logo">
            </div>
            <h1 class="auth-clean-title">{{ t("auth_create_account")|default("Create Account") }}</h1>
            <p class="auth-clean-subtitle">{{ t("auth_register_sub")|default("Join us today to manage your farm efficiently") }}</p>
        </div>

        <form method="POST" action="" class="auth-clean-form">
            {{ form.hidden_tag() }}

            <div class="auth-form-group">
                <label for="name" class="auth-form-label">{{ form.name.label.text }}</label>
                <div class="auth-input-box">
                    <i class="fas fa-user auth-field-icon"></i>
                    {{ form.name(class="auth-clean-input", placeholder=t("auth_name_placeholder")|default("Enter your full name"), id="name", autofocus=true) }}
                </div>
                {% for error in form.name.errors %}
                    <div class="text-danger small mt-1"><i class="fas fa-exclamation-circle"></i> {{ error }}</div>
                {% endfor %}
            </div>

            <div class="auth-form-group">
                <label for="register-email" class="auth-form-label">{{ form.email.label.text }}</label>
                <div class="auth-input-box">
                    <i class="fas fa-envelope auth-field-icon"></i>
                    {{ form.email(class="auth-clean-input", placeholder="example@gmail.com", autocomplete="email", id="register-email") }}
                </div>
                {% for error in form.email.errors %}
                    <div class="text-danger small mt-1"><i class="fas fa-exclamation-circle"></i> {{ error }}</div>
                {% endfor %}
            </div>

            <div class="auth-form-group">
                <div class="auth-label-row">
                    <label for="otp" class="auth-form-label">{{ form.otp.label.text }}</label>
                </div>
                <div class="d-flex" style="gap: 10px;">
                    <div class="auth-input-box" style="flex: 1;">
                        <i class="fas fa-key auth-field-icon"></i>
                        {{ form.otp(class="auth-clean-input", placeholder=t("auth_otp_placeholder")|default("Enter 6-digit code"), id="otp") }}
                    </div>
                    <button type="button" class="btn btn-primary" id="btn-send-otp" style="border-radius: 12px; font-weight: 600; padding: 0 1.2rem;">
                        {{ t("auth_send_code")|default("Send Code") }}
                    </button>
                </div>
                {% for error in form.otp.errors %}
                    <div class="text-danger small mt-1"><i class="fas fa-exclamation-circle"></i> {{ error }}</div>
                {% endfor %}
            </div>

            <div class="auth-form-group">
                <label for="register-password" class="auth-form-label">{{ form.password.label.text }}</label>
                <div class="auth-input-box">
                    <i class="fas fa-lock auth-field-icon"></i>
                    {{ form.password(class="auth-clean-input has-toggle", placeholder=t("auth_password_placeholder")|default("Enter your password"), autocomplete="new-password", id="register-password") }}
                    <button type="button" class="auth-password-toggle-btn" data-target="register-password" aria-label="Toggle password visibility">
                        <i class="far fa-eye"></i>
                    </button>
                </div>
                {% for error in form.password.errors %}
                    <div class="text-danger small mt-1"><i class="fas fa-exclamation-circle"></i> {{ error }}</div>
                {% endfor %}
            </div>

            <div class="auth-form-group">
                <label for="register-confirm-password" class="auth-form-label">{{ form.confirm_password.label.text }}</label>
                <div class="auth-input-box">
                    <i class="fas fa-check-circle auth-field-icon"></i>
                    {{ form.confirm_password(class="auth-clean-input has-toggle", placeholder=t("auth_confirm_password_placeholder")|default("Confirm your password"), autocomplete="new-password", id="register-confirm-password") }}
                    <button type="button" class="auth-password-toggle-btn" data-target="register-confirm-password" aria-label="Toggle password visibility">
                        <i class="far fa-eye"></i>
                    </button>
                </div>
                {% for error in form.confirm_password.errors %}
                    <div class="text-danger small mt-1"><i class="fas fa-exclamation-circle"></i> {{ error }}</div>
                {% endfor %}
            </div>

            <button type="submit" class="auth-primary-btn" style="margin-top: 1rem;">
                <i class="fas fa-user-plus mr-2"></i>
                {{ form.submit.label.text }}
            </button>
        </form>

        <!-- Divider -->
        <div class="auth-clean-divider">
            <span>{{ t("auth_continue_with")|default("or register with") }}</span>
        </div>

        <!-- Social Logins -->
        <div class="auth-social-stack">
            <a class="auth-social-btn" href="{{ url_for('auth.google_login') }}">
                <svg class="auth-google-svg" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>{{ t("auth_google")|default("Register with Google") }}</span>
            </a>
        </div>

        <!-- Footer -->
        <div class="auth-card-footer">
            <span>{{ t("auth_already_have")|default("Already have an account?") }}</span>
            <a href="{{ url_for('auth.login', role='farmer') }}" class="auth-register-link">
                {{ t("auth_log_in")|default("Sign In") }}
            </a>
        </div>
    </div>
</div>

<script src="{{ url_for('static', filename='js/toast.js') }}"></script>
<script>
(function () {
    // Theme sync
    const toggleInput = document.getElementById("authThemeToggle");
    const currentTheme = localStorage.getItem("theme") === "dark" ? "dark" : "light";
    if (toggleInput) {
        toggleInput.checked = (currentTheme === "dark");
        toggleInput.addEventListener("change", () => {
            const isDark = toggleInput.checked;
            const theme = isDark ? "dark" : "light";
            document.documentElement.classList.toggle("dark-mode", isDark);
            document.documentElement.classList.toggle("auth-panel-dark", isDark);
            localStorage.setItem("theme", theme);
            fetch("/users/theme", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ theme })
            }).catch(() => {});
        });
    }

    // Password visibility toggle
    document.querySelectorAll(".auth-password-toggle-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            const targetId = this.getAttribute("data-target");
            const input = document.getElementById(targetId);
            const icon = this.querySelector("i");
            if (input) {
                if (input.type === "password") {
                    input.type = "text";
                    icon.classList.remove("fa-eye", "far");
                    icon.classList.add("fa-eye-slash", "fas");
                } else {
                    input.type = "password";
                    icon.classList.remove("fa-eye-slash", "fas");
                    icon.classList.add("fa-eye", "far");
                }
            }
        });
    });

    // Send OTP logic
    const btnSendOtp = document.getElementById("btn-send-otp");
    const emailInput = document.getElementById("register-email");
    
    if (btnSendOtp && emailInput) {
        btnSendOtp.addEventListener("click", function() {
            const email = emailInput.value.trim();
            if (!email || !email.includes("@")) {
                if(window.Toast) window.Toast.warning("Please enter a valid email address first.");
                else alert("Please enter a valid email address first.");
                emailInput.focus();
                return;
            }
            
            // Start countdown
            let timeLeft = 60;
            btnSendOtp.disabled = true;
            btnSendOtp.style.opacity = "0.7";
            const originalText = btnSendOtp.innerText;
            btnSendOtp.innerText = timeLeft + "s";
            
            const timer = setInterval(() => {
                timeLeft--;
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    btnSendOtp.disabled = false;
                    btnSendOtp.style.opacity = "1";
                    btnSendOtp.innerText = "Resend Code";
                } else {
                    btnSendOtp.innerText = timeLeft + "s";
                }
            }, 1000);
            
            // Make AJAX request
            fetch("/auth/send-register-otp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email: email })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if(window.Toast) window.Toast.success(data.message);
                } else {
                    if(window.Toast) window.Toast.error(data.message || "Failed to send code.");
                    else alert(data.message || "Failed to send code.");
                    clearInterval(timer);
                    btnSendOtp.disabled = false;
                    btnSendOtp.style.opacity = "1";
                    btnSendOtp.innerText = "Send Code";
                }
            })
            .catch(err => {
                console.error(err);
                if(window.Toast) window.Toast.error("An error occurred.");
                clearInterval(timer);
                btnSendOtp.disabled = false;
                btnSendOtp.style.opacity = "1";
                btnSendOtp.innerText = "Send Code";
            });
        });
    }
})();
</script>
</body>
</html>
"""

with open("app/templates/auth/register.html", "w") as f:
    f.write(register_html)

print("register.html rewritten successfully!")
