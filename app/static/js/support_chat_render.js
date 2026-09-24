/* User text is plain text. Never parse messages or attachment URLs as HTML. */

function isSafeSupportImageUrl(src) {
    if (!src || typeof src !== 'string') return false;
    if (src.startsWith('blob:')) return true;
    try {
        let path = src;
        if (src.startsWith('http://') || src.startsWith('https://')) {
            if (typeof URL !== 'undefined') {
                path = new URL(src).pathname;
            } else {
                path = src.replace(/^https?:\/\/[^\/]+/, '').split('?')[0];
            }
        } else {
            path = src.split('?')[0];
        }
        return /^\/static\/uploads\/chats\/[0-9a-fA-F]{32}\.[a-zA-Z0-9]{1,10}$/.test(path);
    } catch (_) {
        return false;
    }
}

window.openSupportImageFullscreen = function (src) {
    if (!src || typeof src !== 'string') return;
    if (typeof document === 'undefined' || !document.createElement) return;

    if (!isSafeSupportImageUrl(src)) return;

    let modal = typeof document.getElementById === 'function' ? document.getElementById('support-image-fullscreen-modal') : null;
    if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'support-image-fullscreen-modal';
        modal.className = 'support-fullscreen-modal';

        const backdrop = document.createElement('div');
        backdrop.className = 'support-fullscreen-backdrop';

        const toolbar = document.createElement('div');
        toolbar.className = 'support-fullscreen-toolbar';

        const btnExpand = document.createElement('button');
        btnExpand.type = 'button';
        btnExpand.className = 'support-fullscreen-btn';
        btnExpand.title = 'Toggle Fullscreen';
        btnExpand.textContent = '⛶';

        const btnClose = document.createElement('button');
        btnClose.type = 'button';
        btnClose.className = 'support-fullscreen-btn support-fullscreen-close';
        btnClose.title = 'Close Fullscreen';
        btnClose.textContent = '✕';

        toolbar.appendChild(btnExpand);
        toolbar.appendChild(btnClose);

        const imgContainer = document.createElement('div');
        imgContainer.className = 'support-fullscreen-img-wrap';

        const img = document.createElement('img');
        img.className = 'support-fullscreen-image';
        img.alt = 'Full screen view';

        imgContainer.appendChild(img);
        modal.appendChild(backdrop);
        modal.appendChild(toolbar);
        modal.appendChild(imgContainer);

        function closeModal() {
            if (modal.classList && typeof modal.classList.remove === 'function') {
                modal.classList.remove('active');
            }
            if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
                document.exitFullscreen().catch(function () {});
            }
            if (typeof modal.close === 'function' && modal.open) {
                try { modal.close(); } catch (_) {}
            }
            setTimeout(function () {
                img.src = '';
                if (modal.style) modal.style.display = 'none';
            }, 180);
        }

        if (typeof backdrop.addEventListener === 'function') {
            backdrop.addEventListener('click', closeModal);
        }
        if (typeof btnClose.addEventListener === 'function') {
            btnClose.addEventListener('click', closeModal);
        }
        if (typeof img.addEventListener === 'function') {
            img.addEventListener('click', function (e) {
                if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                if (img.classList) {
                    if (img.classList.contains('zoomed')) {
                        img.classList.remove('zoomed');
                    } else {
                        img.classList.add('zoomed');
                    }
                }
            });
        }
        if (typeof btnExpand.addEventListener === 'function') {
            btnExpand.addEventListener('click', function (e) {
                if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                if (!document.fullscreenElement) {
                    if (typeof modal.requestFullscreen === 'function') {
                        modal.requestFullscreen().catch(function () {});
                    } else if (typeof modal.webkitRequestFullscreen === 'function') {
                        modal.webkitRequestFullscreen();
                    }
                } else if (typeof document.exitFullscreen === 'function') {
                    document.exitFullscreen().catch(function () {});
                }
            });
        }
        if (typeof document.addEventListener === 'function') {
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && (modal.open || (modal.style && modal.style.display !== 'none'))) {
                    closeModal();
                }
            });
        }
        if (typeof modal.addEventListener === 'function') {
            modal.addEventListener('cancel', function (e) {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                closeModal();
            });
        }

        if (document.body && typeof document.body.appendChild === 'function') {
            document.body.appendChild(modal);
        }
    }

    const fullImg = typeof modal.querySelector === 'function' ? modal.querySelector('.support-fullscreen-image') : null;
    if (fullImg) {
        fullImg.src = src;
        if (fullImg.classList && typeof fullImg.classList.remove === 'function') {
            fullImg.classList.remove('zoomed');
        }
    }
    if (typeof modal.showModal === 'function' && !modal.open) {
        try { modal.showModal(); } catch (_) { if (modal.style) modal.style.display = 'flex'; }
    } else if (modal.style) {
        modal.style.display = 'flex';
    }
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () {
            if (modal.classList && typeof modal.classList.add === 'function') {
                modal.classList.add('active');
            }
        });
    } else if (modal.classList && typeof modal.classList.add === 'function') {
        modal.classList.add('active');
    }
};

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
        element.textContent = '📍 View on Map (' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ')';
        element.className = 'support-location-link';
    } else {
        if (message.attachment_type === 'image') {
            if (!isSafeSupportImageUrl(attachment)) return;
            element = document.createElement('img');
            element.alt = 'Chat attachment';
            element.src = attachment;
            element.className = 'support-chat-image';
            element.style.maxHeight = '200px';
            element.style.cursor = 'zoom-in';
            element.title = 'Click to view full screen';
            if (typeof element.addEventListener === 'function') {
                element.addEventListener('click', function (e) {
                    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                    if (typeof window.openSupportImageFullscreen === 'function') {
                        window.openSupportImageFullscreen(attachment);
                    }
                });
            }
        } else if (message.attachment_type === 'audio') {
            const path = attachment.split('?')[0];
            if (!/^\/static\/uploads\/chats\/[0-9a-fA-F]{32}\.[a-zA-Z0-9]{1,10}$/.test(path)) return;
            element = document.createElement('audio');
            element.controls = true;
            element.preload = 'metadata';
            element.className = 'support-chat-audio';
            element.src = attachment;
        } else return;
    }
    element.style.maxWidth = '100%';
    element.style.marginTop = '4px';
    element.style.display = 'block';
    container.appendChild(element);
};
