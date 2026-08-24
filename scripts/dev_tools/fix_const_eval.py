import re
import os

files = [
    "mobile/lib/screens/farmer_dashboard_screen.dart",
    "mobile/lib/screens/history_screen.dart",
    "mobile/lib/screens/manual_diagnosis_screen.dart",
    "mobile/lib/screens/crop_scan_screen.dart",
    "mobile/lib/screens/login_screen.dart"
]

def fix_consts(content):
    # If a line contains Theme.of(context), remove 'const ' from it
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'Theme.of(context)' in line and 'const ' in line:
            lines[i] = line.replace('const ', '')
    return '\n'.join(lines)

for path in files:
    if os.path.exists(path):
        with open(path, "r") as f:
            content = f.read()
        
        # Replace colors in login and crop scan screens too
        content = re.sub(r'Colors\.black87', r'Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87', content)
        content = re.sub(r'color: Colors\.black,', r'color: Theme.of(context).textTheme.bodyLarge?.color,', content)
        content = re.sub(r'Colors\.black26', r'Theme.of(context).colorScheme.onSurface.withOpacity(0.26)', content)
        content = re.sub(r'Colors\.grey\.shade50\b', r'Theme.of(context).colorScheme.surfaceContainerHighest', content)
        content = re.sub(r'Colors\.grey\.shade100\b', r'Theme.of(context).colorScheme.surfaceContainerHighest', content)
        content = re.sub(r'Colors\.grey\.shade200\b', r'Theme.of(context).dividerColor', content)
        content = re.sub(r'Colors\.grey\.shade300\b', r'Theme.of(context).dividerColor', content)
        content = re.sub(r'Colors\.grey\.shade400\b', r'Theme.of(context).colorScheme.onSurfaceVariant', content)
        content = re.sub(r'Colors\.grey\.shade500\b', r'Theme.of(context).colorScheme.onSurfaceVariant', content)
        content = re.sub(r'Colors\.grey\.shade600\b', r'Theme.of(context).colorScheme.onSurfaceVariant', content)
        content = re.sub(r'Colors\.grey\.shade700\b', r'Theme.of(context).colorScheme.onSurfaceVariant', content)
        content = re.sub(r'Colors\.grey\.shade800\b', r'Theme.of(context).colorScheme.onSurface', content)
        content = re.sub(r'Colors\.grey\.shade900\b', r'Theme.of(context).colorScheme.onSurface', content)
        content = re.sub(r'color: Colors\.grey,', r'color: Theme.of(context).colorScheme.onSurfaceVariant,', content)
        content = re.sub(r'color: Colors\.grey\)', r'color: Theme.of(context).colorScheme.onSurfaceVariant)', content)

        content = fix_consts(content)

        with open(path, "w") as f:
            f.write(content)
