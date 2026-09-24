/* User text is plain text. Never parse messages or attachment URLs as HTML. */

function isSafeSupportImageUrl(src) {
    if (!src || typeof src !== 'string') return false;
    src = src.trim();
    if (src.startsWith('blob:')) return true;
    if (src.startsWith('data:image/')) return true;
    if (/^(?:javascript|vbscript|file):/i.test(src)) return false;
    if (/^\/\//.test(src)) return false; // avoid protocol-relative URLs
    try {
        let path = src;
        if (src.startsWith('http://') || src.startsWith('https://')) {
            if (typeof URL !== 'undefined') {
                path = new URL(src).pathname;
            } else {
                path = src.replace(/^https?:\/\/[^\/]+/, '').split('?')[0];
            }
        } else {
            path = src.split('?')[0].split('#')[0];
        }
        if (/^\/static\/uploads\/chats\/[0-9a-fA-F]{32}\.[a-zA-Z0-9]{1,10}$/.test(path)) {
            return true;
        }
        if (/^\/static\/(?:uploads\/[a-zA-Z0-9_\-\/]+|[a-zA-Z0-9_\-\/]+)\.(?:jpe?g|png|webp|gif|svg|bmp)$/i.test(path)) {
            return true;
        }
        return false;
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
            modal.removeAttribute('open');
            if (modal.style && typeof modal.style.removeProperty === 'function') {
                modal.style.removeProperty('display');
            }
            img.src = '';
            if (img.classList && typeof img.classList.remove === 'function') {
                img.classList.remove('zoomed');
            }
        }

        // Close on clicking modal background or wrapper outside the image and toolbar
        if (typeof modal.addEventListener === 'function') {
            modal.addEventListener('click', function (e) {
                if (e.target && typeof e.target.closest === 'function') {
                    if (e.target.closest('.support-fullscreen-toolbar') || e.target.closest('.support-fullscreen-image')) {
                        return;
                    }
                }
                closeModal();
            });
        }

        if (typeof btnClose.addEventListener === 'function') {
            btnClose.addEventListener('click', function (e) {
                if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                closeModal();
            });
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
                if (e.key === 'Escape' && (modal.open || (modal.classList && modal.classList.contains('active')))) {
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

    if (modal.style && typeof modal.style.removeProperty === 'function') {
        modal.style.removeProperty('display');
    }
    if (modal.classList && typeof modal.classList.add === 'function') {
        modal.classList.add('active');
    }

    if (typeof modal.showModal === 'function') {
        if (!modal.open) {
            try {
                modal.showModal();
            } catch (_) {
                modal.setAttribute('open', '');
                if (modal.style) modal.style.display = 'flex';
            }
        }
    } else {
        modal.setAttribute('open', '');
        if (modal.style) modal.style.display = 'flex';
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
                    const targetSrc = this.currentSrc || this.src || attachment;
                    if (typeof window.openSupportImageFullscreen === 'function') {
                        window.openSupportImageFullscreen(targetSrc);
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
            element.title = 'Voice message';
            if (typeof element.addEventListener === 'function') {
                element.addEventListener('error', function () {
                    element.title = 'This voice message could not be decoded by your browser.';
                });
            }
        } else return;
    }
    element.style.maxWidth = '100%';
    element.style.marginTop = '4px';
    element.style.display = 'block';
    container.appendChild(element);
};
