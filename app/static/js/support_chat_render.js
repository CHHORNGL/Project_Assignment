/* User text is plain text. Never parse messages or attachment URLs as HTML. */
window.renderSupportMessage = function (container, message) {
    const text = document.createElement('div');
    text.textContent = typeof message.message === 'string' ? message.message : '';
    text.style.whiteSpace = 'pre-wrap';
    container.appendChild(text);
    const attachment = message.attachment_url;
    if (typeof attachment !== 'string' || !attachment) return;
    let element;
    if (message.attachment_type === 'location') {
        if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(attachment)) return;
        const [lat, lon] = attachment.split(',').map(Number);
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
        element = document.createElement('a');
        element.href = 'https://maps.google.com/?q=' + encodeURIComponent(attachment);
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
        element.textContent = 'View on Map';
    } else {
        // Also protects against unsafe attachment URLs in previously stored rows.
        if (!/^\/static\/uploads\/chats\/[0-9a-f]{32}\.[a-z0-9]{1,10}$/.test(attachment)) return;
        if (message.attachment_type === 'image') {
            element = document.createElement('img');
            element.alt = 'Chat attachment';
            element.style.maxHeight = '200px';
        } else if (message.attachment_type === 'audio') {
            element = document.createElement('audio');
            element.controls = true;
        } else return;
        element.src = attachment;
    }
    element.style.maxWidth = '100%';
    element.style.marginTop = '4px';
    element.style.display = 'block';
    container.appendChild(element);
};
