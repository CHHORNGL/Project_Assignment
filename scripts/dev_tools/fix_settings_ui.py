import re

with open("app/templates/admin/settings.html", "r") as f:
    html = f.read()

# Replace the Groq input block
groq_block = """
                        <div class="mb-3">
                            <label class="form-label fw-bold">Groq API Keys</label>
                            <div id="groq_keys_container">
                                {% set groq_keys_list = (groq_key or '').split(',') %}
                                {% for key in groq_keys_list %}
                                    {% if key.strip() %}
                                    <div class="input-group mb-2">
                                        <input type="password" class="form-control" name="groq_key[]" value="{{ key.strip() }}" placeholder="gsk_...">
                                        <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
                                    </div>
                                    {% endif %}
                                {% endfor %}
                                <!-- Always show at least one empty input -->
                                <div class="input-group mb-2">
                                    <input type="password" class="form-control" name="groq_key[]" placeholder="gsk_...">
                                    <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-secondary mt-1" onclick="addKeyField('groq_keys_container', 'groq_key[]', 'gsk_...')">
                                <i class="fas fa-plus me-1"></i> Add Another Key
                            </button>
                        </div>
"""
html = re.sub(r'<div class="mb-3">\s*<label for="groq_key".*?</div>', groq_block, html, flags=re.DOTALL)

# Replace the OpenAI input block
openai_block = """
                        <div class="mb-3">
                            <label class="form-label fw-bold">OpenAI API Keys</label>
                            <div id="openai_keys_container">
                                {% set openai_keys_list = (openai_key or '').split(',') %}
                                {% for key in openai_keys_list %}
                                    {% if key.strip() %}
                                    <div class="input-group mb-2">
                                        <input type="password" class="form-control" name="openai_key[]" value="{{ key.strip() }}" placeholder="sk-...">
                                        <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
                                    </div>
                                    {% endif %}
                                {% endfor %}
                                <div class="input-group mb-2">
                                    <input type="password" class="form-control" name="openai_key[]" placeholder="sk-...">
                                    <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-secondary mt-1" onclick="addKeyField('openai_keys_container', 'openai_key[]', 'sk-...')">
                                <i class="fas fa-plus me-1"></i> Add Another Key
                            </button>
                        </div>
"""
html = re.sub(r'<div class="mb-3">\s*<label for="openai_key".*?</div>', openai_block, html, flags=re.DOTALL)

# Replace the Gemini input block
gemini_block = """
                        <div class="mb-3">
                            <label class="form-label fw-bold">Gemini API Keys</label>
                            <div id="gemini_keys_container">
                                {% set gemini_keys_list = (gemini_key or '').split(',') %}
                                {% for key in gemini_keys_list %}
                                    {% if key.strip() %}
                                    <div class="input-group mb-2">
                                        <input type="password" class="form-control" name="gemini_key[]" value="{{ key.strip() }}" placeholder="AIza...">
                                        <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
                                    </div>
                                    {% endif %}
                                {% endfor %}
                                <div class="input-group mb-2">
                                    <input type="password" class="form-control" name="gemini_key[]" placeholder="AIza...">
                                    <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-secondary mt-1" onclick="addKeyField('gemini_keys_container', 'gemini_key[]', 'AIza...')">
                                <i class="fas fa-plus me-1"></i> Add Another Key
                            </button>
                        </div>
"""
html = re.sub(r'<div class="mb-3">\s*<label for="gemini_key".*?</div>', gemini_block, html, flags=re.DOTALL)

# Add the JS function
js_func = """
function addKeyField(containerId, inputName, placeholder) {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'input-group mb-2';
    div.innerHTML = `<input type="password" class="form-control" name="${inputName}" placeholder="${placeholder}">
                     <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>`;
    container.appendChild(div);
}
"""
html = html.replace('function updateProviderVisibility', js_func + '\nfunction updateProviderVisibility')

# Update JS disable logic to use querySelectorAll since IDs are removed
js_disable_logic = """
    const groqModel = document.getElementById('groq_model');
    const openaiModel = document.getElementById('openai_model_select');
    
    // Disable all key inputs
    document.querySelectorAll('input[name="groq_key[]"], input[name="openai_key[]"], input[name="gemini_key[]"]').forEach(el => el.disabled = true);
"""
html = re.sub(r'const groqModel =.*geminiKey\.disabled = true;', js_disable_logic, html, flags=re.DOTALL)

js_enable_logic = """
    if (provider === 'groq') {
        groqSection.style.display = 'block';
        saveButton.style.display = 'block';
        groqModel.disabled = false;
        document.querySelectorAll('input[name="groq_key[]"]').forEach(el => el.disabled = false);
    } else if (provider === 'openai') {
        openaiSection.style.display = 'block';
        saveButton.style.display = 'block';
        openaiModel.disabled = false;
        document.querySelectorAll('input[name="openai_key[]"]').forEach(el => el.disabled = false);
    } else if (provider === 'gemini') {
        geminiSection.style.display = 'block';
        saveButton.style.display = 'block';
        document.querySelectorAll('input[name="gemini_key[]"]').forEach(el => el.disabled = false);
    }
"""
html = re.sub(r'if \(provider === \'groq\'\).*geminiKey\.disabled = false;\n    }', js_enable_logic, html, flags=re.DOTALL)

with open("app/templates/admin/settings.html", "w") as f:
    f.write(html)
