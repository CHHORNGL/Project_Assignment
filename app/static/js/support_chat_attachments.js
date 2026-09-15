/* Shared attachment review for farmer and admin support conversations. */
window.initSupportAttachments = function ({ imgBtn, micBtn, locBtn, fileInput, uploadUrl, getSendUrl, onSent, canOpen = () => true }) {
    [imgBtn, micBtn, locBtn].forEach((button, index) => {
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');
        button.setAttribute('aria-label', ['Send photo', 'Voice message', 'Share location'][index]);
        button.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); button.click(); }
        });
    });
    const dialog = document.createElement('dialog');
    dialog.className = 'support-attachment-dialog';
    dialog.setAttribute('aria-label', 'Send attachment');
    dialog.innerHTML = `<div class="support-attachment-head"><h2>Send attachment</h2><button type="button" data-close aria-label="Close">×</button></div>
        <div class="support-attachment-preview"></div>
        <p class="support-attachment-status" role="status"></p>
        <label class="support-caption-label">Caption <span>(optional)</span><textarea rows="2" maxlength="2000" placeholder="Add a message…"></textarea></label>
        <div class="support-attachment-actions"><button type="button" data-cancel>Cancel</button><button type="button" data-record hidden>Start recording</button><button type="button" data-send disabled>Send</button></div>`;
    document.body.appendChild(dialog);
    const preview = dialog.querySelector('.support-attachment-preview');
    const status = dialog.querySelector('[role="status"]');
    const caption = dialog.querySelector('textarea');
    const send = dialog.querySelector('[data-send]');
    const record = dialog.querySelector('[data-record]');
    const closeButtons = [dialog.querySelector('[data-close]'), dialog.querySelector('[data-cancel]')];
    let draft, recorder, stream, timer, objectUrl, version = 0, busy = false;
    function release() {
        clearInterval(timer);
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        if (stream) stream.getTracks().forEach(track => track.stop());
        recorder = null; stream = null;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        preview.querySelectorAll('audio').forEach(audio => audio.pause());
    }
    function close() {
        if (busy) return;
        version++;
        release();
        dialog.close();
        draft = null;
    }
    closeButtons.forEach(button => button.addEventListener('click', close));
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('close', () => { version++; release(); });
    window.addEventListener('pagehide', () => { version++; release(); });
    function open(type) {
        if (!canOpen()) return false;
        const sendUrl = getSendUrl();
        if (!sendUrl) return false;
        version++; release();
        draft = { type, sendUrl };
        caption.value = ''; preview.replaceChildren(); status.textContent = '';
        send.disabled = true; record.hidden = type !== 'audio'; record.disabled = false;
        record.textContent = 'Start recording';
        dialog.querySelector('h2').textContent = { image: 'Send photo', audio: 'Voice message', location: 'Share location' }[type];
        if (!dialog.open) dialog.showModal();
        return true;
    }
    function showFile(file, type) {
        draft.file = file;
        delete draft.url;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        const media = document.createElement(type === 'image' ? 'img' : 'audio');
        media.src = objectUrl;
        if (type === 'image') media.alt = 'Photo preview';
        else media.controls = true;
        preview.replaceChildren(media);
        status.textContent = type === 'image' ? file.name : 'Listen before sending.';
        send.disabled = false;
    }
    imgBtn.addEventListener('click', () => { if (canOpen()) fileInput.click(); });
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0]; fileInput.value = '';
        if (!file || !open('image')) return;
        if (!file.type.startsWith('image/')) { status.textContent = 'Please choose an image.'; return; }
        showFile(file, 'image');
    });
    micBtn.addEventListener('click', () => {
        if (!open('audio')) return;
        status.textContent = 'Record a voice message, then review it before sending.';
    });
    record.addEventListener('click', async () => {
        if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
        const token = version;
        record.disabled = true; send.disabled = true;
        status.textContent = 'Connecting to microphone…';
        try {
            if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Voice recording is unavailable in this browser.');
            const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (token !== version) { nextStream.getTracks().forEach(track => track.stop()); return; }
            stream = nextStream;
            recorder = new MediaRecorder(stream);
            const chunks = [];
            const activeRecorder = recorder;
            recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
            recorder.addEventListener('stop', () => {
                nextStream.getTracks().forEach(track => track.stop()); clearInterval(timer);
                if (token !== version) return;
                const mime = activeRecorder.mimeType || chunks[0]?.type || 'audio/webm';
                const extension = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
                const file = new File(chunks, `voice.${extension}`, { type: mime });
                if (file.size) showFile(file, 'audio');
                else status.textContent = 'No audio recorded. Try again.';
                record.textContent = 'Record again'; record.disabled = false;
            });
            recorder.addEventListener('error', () => {
                release(); status.textContent = 'Recording failed. Please try again.'; record.disabled = false;
            });
            recorder.start();
            record.disabled = false; record.textContent = 'Stop recording';
            preview.replaceChildren();
            const started = Date.now();
            const update = () => {
                const seconds = Math.floor((Date.now() - started) / 1000);
                status.textContent = `Recording · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
            };
            update(); timer = setInterval(update, 1000);
        } catch (error) {
            if (token !== version) return;
            release(); record.disabled = false;
            status.textContent = error.message || 'Microphone access is unavailable.';
        }
    });
    locBtn.addEventListener('click', () => {
        if (!open('location')) return;
        const token = version;
        status.textContent = 'Finding your current location…';
        if (!navigator.geolocation) { status.textContent = 'Location is unavailable in this browser.'; return; }
        navigator.geolocation.getCurrentPosition(position => {
            if (token !== version) return;
            const { latitude, longitude, accuracy } = position.coords;
            draft.url = `${latitude},${longitude}`;
            const card = document.createElement('a');
            card.className = 'support-location-card';
            card.href = 'https://maps.google.com/?q=' + encodeURIComponent(draft.url);
            card.target = '_blank'; card.rel = 'noopener noreferrer';
            card.textContent = `📍 Current location\n${latitude.toFixed(5)}, ${longitude.toFixed(5)}\nOpen map preview ↗`;
            preview.replaceChildren(card);
            status.textContent = `Accuracy: about ${Math.round(accuracy)} m. Your location is shared only when you press Send.`;
            send.disabled = false;
        }, error => {
            if (token === version) status.textContent = 'Could not get your location: ' + error.message;
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
    async function request(url, options) {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.error) throw new Error(data?.error || 'Could not send. Check your connection and try again.');
        return data;
    }
    send.addEventListener('click', async () => {
        if (busy || send.disabled || !draft) return;
        busy = true; send.disabled = true; record.disabled = true; caption.disabled = true;
        closeButtons.forEach(button => button.disabled = true);
        status.textContent = 'Sending…';
        try {
            if (!draft.url) {
                const body = new FormData(); body.append('file', draft.file);
                const uploaded = await request(uploadUrl, { method: 'POST', body });
                if (!uploaded.url) throw new Error('Upload failed. Please try again.');
                draft.url = uploaded.url;
            }
            const result = await request(draft.sendUrl, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: caption.value.trim(), attachment_url: draft.url, attachment_type: draft.type }),
            });
            if (!result.success) throw new Error('Message was not confirmed. Check chat history before trying again.');
            busy = false; close(); onSent();
        } catch (error) { status.textContent = error.message; }
        finally {
            busy = false; send.disabled = false; record.disabled = false; caption.disabled = false;
            closeButtons.forEach(button => button.disabled = false);
        }
    });
};
