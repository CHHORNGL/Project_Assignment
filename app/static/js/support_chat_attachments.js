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
    const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
    const MAX_RECORDING_SECONDS = 120;
    let draft, recorder, stream, recordingStream, audioContext, timer, maxTimer, objectUrl, version = 0, busy = false;
    function release() {
        clearInterval(timer);
        if (typeof clearTimeout === 'function') clearTimeout(maxTimer);
        if (recorder && recorder.state !== 'inactive') {
            try { recorder.stop(); } catch (_) {}
        }
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (recordingStream && recordingStream !== stream) recordingStream.getTracks().forEach(track => track.stop());
        if (audioContext && typeof audioContext.close === 'function') audioContext.close().catch(() => {});
        recorder = null; stream = null; recordingStream = null; audioContext = null;
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
        if (type === 'image') {
            media.alt = 'Photo preview';
            if (media.style) media.style.cursor = 'zoom-in';
            media.title = 'Click to view full screen';
            if (typeof media.addEventListener === 'function') {
                media.addEventListener('click', () => {
                    if (typeof window.openSupportImageFullscreen === 'function' && objectUrl) {
                        window.openSupportImageFullscreen(objectUrl);
                    }
                });
            }
        } else {
            media.controls = true;
            media.preload = 'auto';
            media.setAttribute('aria-label', 'Voice message preview');
            media.addEventListener?.('error', () => {
                status.textContent = 'This recording cannot be decoded by your browser. Record again or use a different browser.';
                send.disabled = true;
            });
            media.className = 'support-preview-audio';
        }
        preview.replaceChildren(media);
        status.textContent = type === 'image' ? file.name : 'Listen before sending.';
        send.disabled = false;
    }
    imgBtn.addEventListener('click', () => { if (canOpen()) fileInput.click(); });
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0]; fileInput.value = '';
        if (!file || !open('image')) return;
        if (!file.type.startsWith('image/')) { status.textContent = 'Please choose an image.'; return; }
        if (file.size > MAX_ATTACHMENT_BYTES) { status.textContent = 'Photo is too large (maximum 10 MB).'; return; }
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
            let nextStream;
            try {
                // Ask the browser for a mono, 48 kHz voice track. Hardware may choose a
                // different rate, but these constraints avoid unnecessary channel mixing
                // and enable the browser's built-in acoustic echo/noise processing.
                nextStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: { ideal: 48000 },
                        sampleSize: { ideal: 16 },
                        channelCount: { ideal: 1 },
                        latency: { ideal: 0.02 },
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            } catch (constraintsErr) {
                nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            if (token !== version) { nextStream.getTracks().forEach(track => track.stop()); return; }
            stream = nextStream;

            // Add a gentle high-pass filter and compressor when Web Audio is available.
            // This removes handling/air-conditioner rumble and keeps speech intelligible
            // without requiring a server-side transcoder. If unavailable, record the
            // browser-cleaned microphone stream directly.
            let recorderInput = nextStream;
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (AudioContextCtor && typeof AudioContextCtor === 'function') {
                try {
                    audioContext = new AudioContextCtor({ sampleRate: 48000, latencyHint: 'interactive' });
                    if (audioContext.state === 'suspended' && typeof audioContext.resume === 'function') audioContext.resume().catch(() => {});
                    const source = audioContext.createMediaStreamSource(nextStream);
                    const highPass = audioContext.createBiquadFilter();
                    highPass.type = 'highpass'; highPass.frequency.value = 75; highPass.Q.value = 0.7;
                    const compressor = audioContext.createDynamicsCompressor();
                    compressor.threshold.value = -28; compressor.knee.value = 18;
                    compressor.ratio.value = 3; compressor.attack.value = 0.003; compressor.release.value = 0.25;
                    const destination = audioContext.createMediaStreamDestination();
                    source.connect(highPass); highPass.connect(compressor); compressor.connect(destination);
                    recorderInput = destination.stream;
                    recordingStream = recorderInput;
                } catch (_) {
                    if (audioContext && typeof audioContext.close === 'function') audioContext.close().catch(() => {});
                    audioContext = null; recordingStream = null;
                }
            }

            let mimeType = '';
            const candidates = [
                'audio/webm;codecs=opus',
                'audio/ogg;codecs=opus',
                'audio/mp4',
                'audio/webm',
                'audio/ogg'
            ];
            if (typeof window.MediaRecorder.isTypeSupported === 'function') {
                for (const cand of candidates) {
                    if (window.MediaRecorder.isTypeSupported(cand)) {
                        mimeType = cand;
                        break;
                    }
                }
            }
            const recorderOpts = {};
            if (mimeType) recorderOpts.mimeType = mimeType;
            recorderOpts.audioBitsPerSecond = 96000;

            recorder = new MediaRecorder(recorderInput, recorderOpts);
            const chunks = [];
            const activeRecorder = recorder;
            recorder.addEventListener('dataavailable', event => {
                if (event.data && event.data.size > 0) chunks.push(event.data);
            });
            recorder.addEventListener('stop', () => {
                nextStream.getTracks().forEach(track => track.stop());
                if (recordingStream && recordingStream !== nextStream) recordingStream.getTracks().forEach(track => track.stop());
                clearInterval(timer); if (typeof clearTimeout === 'function') clearTimeout(maxTimer);
                if (audioContext && typeof audioContext.close === 'function') audioContext.close().catch(() => {});
                audioContext = null; recordingStream = null; stream = null;
                if (token !== version) return;
                const mime = activeRecorder.mimeType || chunks[0]?.type || mimeType || 'audio/webm';
                let extension = 'webm';
                if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) {
                    extension = 'm4a';
                } else if (mime.includes('ogg')) {
                    extension = 'ogg';
                } else if (mime.includes('webm')) {
                    extension = 'webm';
                }
                const file = new File(chunks, `voice.${extension}`, { type: mime });
                if (file.size > MAX_ATTACHMENT_BYTES) status.textContent = 'Recording is too large. Keep voice messages under 2 minutes.';
                else if (file.size) showFile(file, 'audio');
                else status.textContent = 'No audio recorded. Try again.';
                record.textContent = 'Record again'; record.disabled = false;
            });
            recorder.addEventListener('error', () => {
                release(); status.textContent = 'Recording failed. Please try again.'; record.disabled = false;
            });
            // Continuous single-stream recording avoids timeslice packet boundaries that cause clicks and stutter
            recorder.start();
            record.disabled = false; record.textContent = 'Stop recording';
            preview.replaceChildren();
            const started = Date.now();
            const update = () => {
                const seconds = Math.floor((Date.now() - started) / 1000);
                status.textContent = `Recording (noise reduced, 48 kHz) · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
            };
            update(); timer = setInterval(update, 1000);
            maxTimer = setTimeout(() => {
                if (recorder && recorder.state === 'recording') {
                    status.textContent = 'Maximum 2-minute recording reached. Preparing preview…';
                    recorder.stop();
                }
            }, MAX_RECORDING_SECONDS * 1000);
        } catch (error) {
            if (token !== version) return;
            release(); record.disabled = false;
            status.textContent = error.message || 'Microphone access is unavailable.';
        }
    });

    const CAMBODIA_PROVINCES = [
        ['Phnom Penh', 11.5564, 104.9282],
        ['Siem Reap', 13.3671, 103.8448],
        ['Battambang', 13.0957, 103.2022],
        ['Kandal', 11.4555, 104.9458],
        ['Kampong Cham', 11.9924, 105.4645],
        ['Kampong Chhnang', 12.2500, 104.6667],
        ['Kampong Speu', 11.4533, 104.5209],
        ['Kampong Thom', 12.7111, 104.8887],
        ['Kampot', 10.6104, 104.1815],
        ['Kep', 10.4829, 104.3167],
        ['Koh Kong', 11.6153, 102.9838],
        ['Kratie', 12.4881, 106.0188],
        ['Mondulkiri', 12.4558, 107.1881],
        ['Oddar Meanchey', 14.1817, 103.5176],
        ['Pailin', 12.8489, 102.6093],
        ['Preah Sihanouk', 10.6253, 103.5234],
        ['Preah Vihear', 13.8073, 104.9817],
        ['Prey Veng', 11.4851, 105.3253],
        ['Pursat', 12.5333, 103.9167],
        ['Ratanakiri', 13.7394, 106.9873],
        ['Stung Treng', 13.5259, 105.9683],
        ['Svay Rieng', 11.0879, 105.7993],
        ['Takeo', 10.9908, 104.7850],
        ['Tboung Khmum', 11.9167, 105.6500],
        ['Banteay Meanchey', 13.5859, 102.9737]
    ];

    locBtn.addEventListener('click', () => {
        if (!open('location')) return;
        const token = version;
        const baseEndpoint = uploadUrl ? uploadUrl.replace(/\/upload$/, '') : '/farmer/support_chat';

        function setLocationDraft(latitude, longitude, accuracy, placeName) {
            draft.url = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

            const container = document.createElement('div');
            container.className = 'support-map-wrapper';

            // Top controls: Province Quick Select & Search
            const toolbar = document.createElement('div');
            toolbar.className = 'support-map-toolbar';

            const selectProvince = document.createElement('select');
            selectProvince.className = 'support-map-province-select';
            selectProvince.setAttribute('aria-label', 'Select Cambodia Province');

            const optDefault = document.createElement('option');
            optDefault.value = '';
            optDefault.textContent = '📍 Quick Province Select…';
            selectProvince.appendChild(optDefault);

            CAMBODIA_PROVINCES.forEach(([name, pLat, pLon]) => {
                const opt = document.createElement('option');
                opt.value = `${pLat.toFixed(6)},${pLon.toFixed(6)}`;
                opt.textContent = name;
                if (placeName && placeName.includes(name)) opt.selected = true;
                selectProvince.appendChild(opt);
            });

            const searchRow = document.createElement('div');
            searchRow.className = 'support-map-search-row';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'support-map-search-input';
            searchInput.placeholder = 'Search town, district, or place…';

            const searchBtn = document.createElement('button');
            searchBtn.type = 'button';
            searchBtn.className = 'support-map-btn support-btn-search';
            searchBtn.textContent = '🔍 Search';

            searchRow.appendChild(searchInput);
            searchRow.appendChild(searchBtn);

            toolbar.appendChild(selectProvince);
            toolbar.appendChild(searchRow);

            // Interactive Map Iframe Container
            const mapFrameWrap = document.createElement('div');
            mapFrameWrap.className = 'support-map-container';

            const iframe = document.createElement('iframe');
            iframe.className = 'support-map-iframe';
            iframe.title = 'Current Location Map';
            iframe.loading = 'lazy';
            iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
            iframe.src = `https://maps.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}&hl=en&z=15&output=embed`;
            mapFrameWrap.appendChild(iframe);

            // Card with place title, map link & coordinate controls
            const card = document.createElement('div');
            card.className = 'support-map-card';

            const placeRow = document.createElement('div');
            placeRow.className = 'support-map-place';

            const placeText = document.createElement('span');
            placeText.textContent = `📍 ${placeName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}`;

            const mapLink = document.createElement('a');
            mapLink.className = 'support-map-link';
            mapLink.href = 'https://maps.google.com/?q=' + encodeURIComponent(draft.url);
            mapLink.target = '_blank';
            mapLink.rel = 'noopener noreferrer';
            mapLink.textContent = 'Open in Google Maps ↗';

            placeRow.appendChild(placeText);
            placeRow.appendChild(mapLink);

            const controls = document.createElement('div');
            controls.className = 'support-map-controls';

            const coordInputs = document.createElement('div');
            coordInputs.className = 'support-map-coord-inputs';

            const latLabel = document.createElement('label');
            latLabel.textContent = 'Lat: ';
            const latInput = document.createElement('input');
            latInput.type = 'number';
            latInput.step = '0.000001';
            latInput.value = latitude.toFixed(6);
            latLabel.appendChild(latInput);

            const lonLabel = document.createElement('label');
            lonLabel.textContent = 'Lng: ';
            const lonInput = document.createElement('input');
            lonInput.type = 'number';
            lonInput.step = '0.000001';
            lonInput.value = longitude.toFixed(6);
            lonLabel.appendChild(lonInput);

            const btnApply = document.createElement('button');
            btnApply.type = 'button';
            btnApply.className = 'support-map-btn support-btn-apply';
            btnApply.textContent = 'Update Map';

            const btnGps = document.createElement('button');
            btnGps.type = 'button';
            btnGps.className = 'support-map-btn';
            btnGps.textContent = '🎯 My GPS';

            coordInputs.appendChild(latLabel);
            coordInputs.appendChild(lonLabel);
            coordInputs.appendChild(btnApply);
            coordInputs.appendChild(btnGps);
            controls.appendChild(coordInputs);

            card.appendChild(placeRow);
            card.appendChild(controls);

            container.appendChild(toolbar);
            container.appendChild(mapFrameWrap);
            container.appendChild(card);

            preview.replaceChildren(container);

            if (typeof selectProvince.addEventListener === 'function') {
                selectProvince.addEventListener('change', () => {
                    const val = selectProvince.value;
                    if (!val) return;
                    const [pLat, pLon] = val.split(',').map(Number);
                    const selOpt = selectProvince.options ? selectProvince.options[selectProvince.selectedIndex] : null;
                    const pName = selOpt ? selOpt.textContent : '';
                    resolvePlaceName(pLat, pLon, null, pName ? `${pName}, Cambodia` : null);
                });
            }

            const executeSearch = () => {
                const q = searchInput.value.trim();
                if (!q) return;
                status.textContent = `Searching "${q}"…`;
                const qLower = q.toLowerCase();
                const matched = CAMBODIA_PROVINCES.find(p => p[0].toLowerCase().includes(qLower));
                if (matched) {
                    resolvePlaceName(matched[1], matched[2], null, `${matched[0]}, Cambodia`);
                    return;
                }
                fetch(`${baseEndpoint}/location/search?q=${encodeURIComponent(q)}`, { credentials: 'same-origin' })
                    .then(r => r.ok ? r.json() : [])
                    .then(results => {
                        if (token !== version) return;
                        if (Array.isArray(results) && results.length > 0) {
                            resolvePlaceName(results[0].latitude, results[0].longitude, null, results[0].name);
                        } else {
                            status.textContent = `No location found for "${q}". Try selecting a province above.`;
                        }
                    })
                    .catch(() => {
                        if (token === version) status.textContent = `Search error. Select a province or enter coordinates.`;
                    });
            };

            if (typeof searchBtn.addEventListener === 'function') {
                searchBtn.addEventListener('click', executeSearch);
            }
            if (typeof searchInput.addEventListener === 'function') {
                searchInput.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { e.preventDefault(); executeSearch(); }
                });
            }

            if (typeof btnApply.addEventListener === 'function') {
                btnApply.addEventListener('click', () => {
                    const newLat = parseFloat(latInput.value);
                    const newLon = parseFloat(lonInput.value);
                    if (!isNaN(newLat) && !isNaN(newLon) && -90 <= newLat && newLat <= 90 && -180 <= newLon && newLon <= 180) {
                        resolvePlaceName(newLat, newLon, null);
                    }
                });
            }

            if (typeof btnGps.addEventListener === 'function') {
                btnGps.addEventListener('click', () => {
                    detectLocation();
                });
            }

            const accLabel = typeof accuracy === 'number' && accuracy > 0 ? ` (±${Math.round(accuracy)}m)` : '';
            status.textContent = placeName
                ? `Location: ${placeName}${accLabel}. Ready to send or adjust above.`
                : `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accLabel}. Ready to send or adjust above.`;

            if (caption && !caption.value.trim() && placeName) {
                caption.value = `📍 Location: ${placeName}`;
            }
            send.disabled = false;
        }

        function resolvePlaceName(lat, lon, acc, knownName) {
            if (knownName) {
                setLocationDraft(lat, lon, acc, knownName);
                return;
            }
            setLocationDraft(lat, lon, acc, null);
            fetch(`${baseEndpoint}/location?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, { credentials: 'same-origin' })
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (token !== version || !data) return;
                    const name = data.display_name || data.city || '';
                    if (name) {
                        setLocationDraft(lat, lon, acc, name);
                    }
                })
                .catch(() => {});
        }

        if (!navigator.geolocation) {
            setLocationDraft(11.5564, 104.9282, null, 'Phnom Penh, Cambodia');
            status.textContent = 'Location is unavailable in this browser. Select your province or search on the map below.';
            return;
        }

        function detectLocation() {
            status.textContent = 'Finding your real location…';
            navigator.geolocation.getCurrentPosition(position => {
                if (token !== version) return;
                const { latitude, longitude, accuracy } = position.coords;
                resolvePlaceName(latitude, longitude, accuracy);
            }, error => {
                if (token !== version) return;
                navigator.geolocation.getCurrentPosition(position => {
                    if (token !== version) return;
                    const { latitude, longitude, accuracy } = position.coords;
                    resolvePlaceName(latitude, longitude, accuracy);
                }, () => {
                    if (token !== version) return;
                    fetch(`${baseEndpoint}/location`, { credentials: 'same-origin' })
                        .then(r => r.ok ? r.json() : null)
                        .then(data => {
                            if (token !== version) return;
                            if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                                resolvePlaceName(data.latitude, data.longitude, null, data.display_name);
                            } else {
                                setLocationDraft(11.5564, 104.9282, null, 'Phnom Penh, Cambodia');
                                status.textContent = 'GPS signal unavailable. You can select your province or search above.';
                            }
                        })
                        .catch(() => {
                            if (token === version) {
                                setLocationDraft(11.5564, 104.9282, null, 'Phnom Penh, Cambodia');
                                status.textContent = 'GPS signal unavailable. You can select your province or search above.';
                            }
                        });
                }, { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 });
            }, { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 });
        }

        detectLocation();
    });
    async function request(url, options, { retries = 0, timeoutMs = 30000 } = {}) {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            const controller = typeof AbortController === 'function' ? new AbortController() : null;
            const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
            try {
                const response = await fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
                const data = await response.json().catch(() => null);
                if (!response.ok || !data || data.error) throw new Error(data?.error || `Request failed (${response.status}). Check your connection and try again.`);
                return data;
            } catch (error) {
                lastError = error.name === 'AbortError' ? new Error('Upload timed out. Check your connection and try again.') : error;
                if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            } finally { if (timeout) clearTimeout(timeout); }
        }
        throw lastError || new Error('Could not send. Check your connection and try again.');
    }
    send.addEventListener('click', async () => {
        if (busy || send.disabled || !draft) return;
        busy = true; send.disabled = true; record.disabled = true; caption.disabled = true;
        closeButtons.forEach(button => button.disabled = true);
        status.textContent = 'Sending…';
        try {
            if (!draft.url) {
                if (!draft.file || (typeof draft.file.size === 'number' && !draft.file.size)) throw new Error('The recording is empty. Please record again.');
                if (typeof draft.file.size === 'number' && draft.file.size > MAX_ATTACHMENT_BYTES) throw new Error('Audio is too large (maximum 10 MB).');
                const body = new FormData(); body.append('file', draft.file, draft.file.name || 'voice.webm');
                const uploaded = await request(uploadUrl, { method: 'POST', body }, { retries: 2, timeoutMs: 30000 });
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
