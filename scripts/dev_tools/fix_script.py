import re

with open("app/templates/admin/settings.html", "r") as f:
    html = f.read()

script_block = """<script>
function addKeyField(containerId, inputName, placeholder) {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'input-group mb-2';
    div.innerHTML = `<input type="password" class="form-control" name="${inputName}" placeholder="${placeholder}">
                     <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>`;
    container.appendChild(div);
}

function updateProviderVisibility() {
    const provider = document.getElementById('provider_selector').value;
    
    const groqSection = document.getElementById('groq_section');
    const openaiSection = document.getElementById('openai_section');
    const geminiSection = document.getElementById('gemini_section');
    const saveButton = document.getElementById('save_button_container');
    
    // Disable inputs that are hidden so they don't overwrite the DB with empty/wrong values
    const groqModel = document.getElementById('groq_model');
    const openaiModel = document.getElementById('openai_model_select');
    
    // Disable all key inputs
    document.querySelectorAll('input[name="groq_key[]"], input[name="openai_key[]"], input[name="gemini_key[]"]').forEach(el => el.disabled = true);
    
    // Reset visibility
    groqSection.style.display = 'none';
    openaiSection.style.display = 'none';
    geminiSection.style.display = 'none';
    saveButton.style.display = 'none';
    
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
}

// Run on page load to hide everything initially
document.addEventListener("DOMContentLoaded", function() {
    // Determine if we should pre-select a provider based on current model
    const currentModel = "{{ openai_model }}";
    const providerSelect = document.getElementById('provider_selector');
    
    if (currentModel.includes('llama') || currentModel.includes('mixtral')) {
        providerSelect.value = 'groq';
    } else if (currentModel.includes('gpt')) {
        providerSelect.value = 'openai';
    } else if ("{{ gemini_key }}" !== "") {
        providerSelect.value = 'gemini';
    }
    
    updateProviderVisibility();
});
</script>"""

html = re.sub(r'<script>.*?</script>', script_block, html, flags=re.DOTALL)

with open("app/templates/admin/settings.html", "w") as f:
    f.write(html)
