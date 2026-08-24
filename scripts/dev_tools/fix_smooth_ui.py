import re

with open("app/templates/admin/settings.html", "r") as f:
    html = f.read()

# 1. Add CSS for smooth animations
css_block = """
{% block content %}
<style>
.smooth-fade {
    animation: smoothFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes smoothFadeIn {
    from { 
        opacity: 0; 
        transform: translateY(-8px); 
    }
    to { 
        opacity: 1; 
        transform: translateY(0); 
    }
}
.input-group {
    transition: all 0.3s ease;
}
</style>
"""
html = html.replace('{% block content %}', css_block)

# 2. Add 'smooth-fade' class to the provider sections
html = html.replace('id="groq_section" style="display: none;" class="p-4 bg-light rounded-4 border"', 'id="groq_section" style="display: none;" class="p-4 bg-light rounded-4 border smooth-fade"')
html = html.replace('id="openai_section" style="display: none;" class="p-4 bg-light rounded-4 border"', 'id="openai_section" style="display: none;" class="p-4 bg-light rounded-4 border smooth-fade"')
html = html.replace('id="gemini_section" style="display: none;" class="p-4 bg-light rounded-4 border"', 'id="gemini_section" style="display: none;" class="p-4 bg-light rounded-4 border smooth-fade"')
html = html.replace('id="save_button_container" style="display: none;"', 'id="save_button_container" style="display: none;" class="smooth-fade"')

# 3. Add 'smooth-fade' class to dynamically added inputs
js_func = """function addKeyField(containerId, inputName, placeholder) {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'input-group mb-2 smooth-fade';
    div.innerHTML = `<input type="password" class="form-control" name="${inputName}" placeholder="${placeholder}">
                     <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>`;
    container.appendChild(div);
}"""
html = re.sub(r'function addKeyField.*?\}', js_func, html, flags=re.DOTALL)

with open("app/templates/admin/settings.html", "w") as f:
    f.write(html)
