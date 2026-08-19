import re
import os

files = [
    "mobile/lib/screens/farmer_dashboard_screen.dart",
    "mobile/lib/screens/history_screen.dart",
    "mobile/lib/screens/manual_diagnosis_screen.dart",
]

def replace_colors(content):
    # Text colors
    content = re.sub(r'Colors\.black87', r'Theme.of(context).textTheme.bodyLarge?.color ?? Colors.black87', content)
    content = re.sub(r'color: Colors\.black,', r'color: Theme.of(context).textTheme.bodyLarge?.color,', content)
    
    # Grey shades
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

    # Note: we skip `Colors.black.withOpacity` since we already handled `withValues` or those are shadow colors which are fine.
    
    return content

for path in files:
    if os.path.exists(path):
        with open(path, "r") as f:
            content = f.read()
        content = replace_colors(content)
        with open(path, "w") as f:
            f.write(content)
