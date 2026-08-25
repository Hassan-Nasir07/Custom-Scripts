    // ============================================================
    // CYBERPUNK AUDIO — spectrum rail and the --rt-beat coupling
    //
    // Generated from cyber-dev/cyber-audio.js. Do not edit the copy in the
    // userscript; edit here and run node cyber-dev/reinsert.js.
    //
    // WHAT A BROWSER CAN AND CANNOT DO HERE, because the limits shape all of
    // the code below:
    //
    //   There is no system-loopback tap in the Web Audio API. The ONLY way to
    //   analyse "whatever is playing on this machine" is
    //   getDisplayMedia({ audio: true }), which:
    //     - requires a user gesture, every session;
    //     - shows the share picker, and on Windows only actually carries
    //       system output when the user ticks "Also share system audio";
    //     - requires a video constraint (audio-only getDisplayMedia is not
    //       allowed), so the video track is stopped and dropped immediately;
    //     - leaves a "sharing your screen" banner up while it runs.
    //
    //   So the rail is tiered, and NOTHING here ever requests a permission
    //   without a click:
    //     system -> real system output      (share picker)
    //     mic    -> speakers, ambiently     (one prompt, persists)
    //     sim    -> procedural              (no permission at all)
    //
    // The button cycles OFF -> SYS -> MIC -> SIM -> OFF. A declined grant
    // does NOT auto-escalate to the next tier: firing a microphone prompt
    // immediately after someone cancelled a screen-share prompt is a second
    // surprise, so the tier is marked failed and the next click moves on.
    // ============================================================

    const CYBER_EQ_BARS = 32;
    const CYBER_EQ_SOURCES = ['off', 'system', 'mic', 'sim'];

    let cyberAudioCtx = null;
    let cyberAnalyser = null;
    let cyberFreqData = null;
    let cyberStream = null;
    let cyberStreamNode = null;
    let cyberEqRaf = null;
    let cyberEqLastFrame = 0;
    let cyberEqCanvas = null;
    let cyberEqCssW = 0;
    let cyberEqCssH = 0;

    // Beat detection state.
    let cyberBassAvg = 0;
    let cyberBeat = 0;
    let cyberBeatWritten = -1;

    // Peak-hold per bar, so the rail reads as a meter rather than a blur.
    let cyberPeaks = new Array(CYBER_EQ_BARS).fill(0);

    // 'off' | 'system' | 'mic' | 'sim'; plus whether the last grant failed.
    let cyberEqMode = 'off';
    let cyberEqFailed = false;

    function cyberEqSource() {
        const s = userPreferences.cyberAudioSource;
        return CYBER_EQ_SOURCES.indexOf(s) === -1 ? 'off' : s;
    }

    // ------------------------------------------------------------------
    // Source acquisition
    // ------------------------------------------------------------------

    function cyberMakeContext() {
        if (cyberAudioCtx) return cyberAudioCtx;
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        cyberAudioCtx = new Ctor();
        cyberAnalyser = cyberAudioCtx.createAnalyser();
        cyberAnalyser.fftSize = 512;
        cyberAnalyser.smoothingTimeConstant = 0.72;
        cyberFreqData = new Uint8Array(cyberAnalyser.frequencyBinCount);
        return cyberAudioCtx;
    }

    // Wires a MediaStream into the analyser. Deliberately does NOT connect to
    // destination — routing captured system audio back to the speakers would
    // feed back.
    function cyberAttachStream(stream) {
        if (!cyberMakeContext()) return false;
        cyberDetachStream();
        cyberStream = stream;
        cyberStreamNode = cyberAudioCtx.createMediaStreamSource(stream);
        cyberStreamNode.connect(cyberAnalyser);

        // The user can end a screen-share from Chrome's own banner, which we
        // only learn about through the track. Without this the rail would sit
        // at zero forever and look broken.
        stream.getTracks().forEach(function (t) {
            t.addEventListener('ended', function () {
                if (cyberStream === stream) cyberEqFallbackToSim('share ended');
            });
        });
        if ('oninactive' in stream) {
            stream.oninactive = function () {
                if (cyberStream === stream) cyberEqFallbackToSim('stream inactive');
            };
        }
        return true;
    }

    function cyberDetachStream() {
        if (cyberStreamNode) {
            try { cyberStreamNode.disconnect(); } catch (e) { /* already gone */ }
            cyberStreamNode = null;
        }
        if (cyberStream) {
            cyberStream.getTracks().forEach(function (t) {
                try { t.stop(); } catch (e) { /* already stopped */ }
            });
            cyberStream = null;
        }
    }

    function cyberEqFallbackToSim(why) {
        cyberDetachStream();
        cyberEqMode = 'sim';
        cyberEqFailed = false;
        userPreferences.cyberAudioSource = 'sim';
        savePreferences();
        cyberEqUpdateButton();
        if (why) console.info('[CyberEQ] ' + why + ' — falling back to the procedural rail.');
    }

    async function cyberEqConnectSystem() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return false;
        // A video constraint is mandatory: getDisplayMedia rejects audio-only.
        // The track is stopped the moment we have the stream, so no frames are
        // ever read, but the audio track stays live.
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1, height: 1, frameRate: 1 },
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        const audio = stream.getAudioTracks();
        if (!audio.length) {
            // The user shared a surface but left "share system audio" unticked.
            stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
            throw new Error('no audio track — "Also share system audio" was not ticked');
        }
        stream.getVideoTracks().forEach(function (t) {
            try { t.stop(); } catch (e) {}
            try { stream.removeTrack(t); } catch (e) {}
        });
        return cyberAttachStream(stream);
    }

    async function cyberEqConnectMic() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
        // These three must be off. Left on, the browser gates and levels the
        // signal for speech, and the analyser sees a flattened version of the
        // music rather than the music.
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        return cyberAttachStream(stream);
    }

    // Advances one tier. Called from the rail button and nowhere else, so the
    // gesture requirement is satisfied by construction.
    async function cyberEqCycle() {
        const order = CYBER_EQ_SOURCES;
        const from = cyberEqFailed ? cyberEqMode : cyberEqSource();
        const next = order[(order.indexOf(from) + 1) % order.length];

        cyberDetachStream();
        cyberEqFailed = false;
        cyberEqMode = next;
        userPreferences.cyberAudioSource = next;
        savePreferences();
        cyberEqUpdateButton();

        if (next === 'off') { cyberEqStopLoop(); cyberEqClearBeat(); return; }

        if (next === 'sim') { cyberEqStartLoop(); return; }

        try {
            if (cyberMakeContext() && cyberAudioCtx.state === 'suspended') {
                await cyberAudioCtx.resume();
            }
            const ok = next === 'system' ? await cyberEqConnectSystem() : await cyberEqConnectMic();
            if (!ok) throw new Error('capture unavailable in this browser');
            cyberEqFailed = false;
        } catch (err) {
            // Cancelling the picker is a normal outcome, not an error worth
            // shouting about. Mark the tier failed so the next click moves on.
            cyberEqFailed = true;
            console.info('[CyberEQ] ' + next + ' unavailable: ' + (err && err.message ? err.message : err));
        }
        cyberEqUpdateButton();
        cyberEqStartLoop();
    }

    // Restores the saved source on load. Never prompts: 'system' always waits
    // for a click, and 'mic' resumes only if the permission is already granted.
    async function cyberEqAutoResume() {
        const want = cyberEqSource();
        if (want === 'off') return;
        cyberEqMode = want;

        if (want === 'sim') { cyberEqStartLoop(); cyberEqUpdateButton(); return; }

        if (want === 'system') {
            // No gesture at load, and the picker cannot be opened without one.
            cyberEqFailed = true;
            cyberEqUpdateButton();
            cyberEqStartLoop();
            return;
        }

        let granted = false;
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const st = await navigator.permissions.query({ name: 'microphone' });
                granted = st && st.state === 'granted';
            }
        } catch (e) { granted = false; }

        if (!granted) {
            cyberEqFailed = true;
            cyberEqUpdateButton();
            cyberEqStartLoop();
            return;
        }
        try {
            cyberMakeContext();
            await cyberEqConnectMic();
        } catch (e) {
            cyberEqFailed = true;
        }
        cyberEqUpdateButton();
        cyberEqStartLoop();
    }

    // ------------------------------------------------------------------
    // The rail
    // ------------------------------------------------------------------

    function cyberEqUpdateButton() {
        const btn = document.getElementById('cyber-eq-btn');
        if (!btn) return;
        const label = { off: 'OFF', system: 'SYS', mic: 'MIC', sim: 'SIM' };
        const mode = cyberEqFailed ? cyberEqMode : cyberEqSource();
        btn.textContent = (cyberEqFailed ? '! ' : '') + (label[mode] || 'OFF');
        btn.classList.toggle('is-live', !cyberEqFailed && (mode === 'system' || mode === 'mic'));
        btn.classList.toggle('is-sim', !cyberEqFailed && mode === 'sim');
        btn.title = cyberEqFailed
            ? mode + ' is not connected — click to try the next source'
            : 'Audio source: ' + mode + ' — click to cycle (system / mic / procedural / off)';
    }

    function cyberEqClearBeat() {
        const root = document.getElementById('total-time-summary');
        if (root) root.style.setProperty('--rt-beat', '0');
        cyberBeat = 0;
        cyberBeatWritten = -1;
    }

    // Procedural spectrum: no audio, no permission, and it must never look
    // like a dead rail. Deterministic in t so it does not jitter.
    function cyberSimBar(i, t) {
        const p = i / CYBER_EQ_BARS;
        const a = Math.sin(t * 0.0021 + i * 0.55) * 0.5 + 0.5;
        const b = Math.sin(t * 0.0009 - i * 0.31) * 0.5 + 0.5;
        const c = Math.sin(t * 0.0043 + i * 1.7) * 0.5 + 0.5;
        // Tilted so the lows sit higher than the highs, like real music.
        const tilt = 1 - p * 0.55;
        return Math.max(0, Math.min(1, (a * 0.5 + b * 0.32 + c * 0.18) * tilt));
    }

    function cyberEqReadBars(t) {
        const bars = new Array(CYBER_EQ_BARS);
        const live = cyberAnalyser && cyberStream;
        if (!live) {
            for (let i = 0; i < CYBER_EQ_BARS; i++) bars[i] = cyberSimBar(i, t);
            return bars;
        }
        cyberAnalyser.getByteFrequencyData(cyberFreqData);
        const n = cyberFreqData.length;
        // Roughly logarithmic binning: an even split would spend most of the
        // rail on inaudible high frequencies and look almost flat.
        for (let i = 0; i < CYBER_EQ_BARS; i++) {
            const lo = Math.floor(Math.pow(i / CYBER_EQ_BARS, 2) * (n - 1));
            const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / CYBER_EQ_BARS, 2) * (n - 1)));
            let sum = 0;
            for (let k = lo; k < hi; k++) sum += cyberFreqData[k];
            bars[i] = (sum / (hi - lo)) / 255;
        }
        return bars;
    }

    // Bass energy against a rolling average. An absolute threshold would
    // never suit both a quiet mic and a hot system capture.
    function cyberEqUpdateBeat(bars) {
        let bass = 0;
        for (let i = 0; i < 6; i++) bass += bars[i];
        bass /= 6;
        cyberBassAvg = cyberBassAvg * 0.94 + bass * 0.06;
        const rel = cyberBassAvg > 0.001 ? (bass / cyberBassAvg) - 1 : 0;
        const target = Math.max(0, Math.min(1, rel * 1.3));
        // Fast attack, slow release, so a kick reads as a hit not a wobble.
        cyberBeat = target > cyberBeat ? target : cyberBeat * 0.86 + target * 0.14;

        const root = document.getElementById('total-time-summary');
        if (!root) return;
        // Writing a custom property invalidates style for the subtree, so only
        // write when it actually moved.
        const q = Math.round(cyberBeat * 50) / 50;
        if (q !== cyberBeatWritten) {
            root.style.setProperty('--rt-beat', String(q));
            cyberBeatWritten = q;
        }
    }

    function cyberEqResize() {
        const cv = cyberEqCanvas;
        if (!cv) return false;
        const w = cv.clientWidth;
        const h = cv.clientHeight;
        if (!w || !h) return false;
        if (w === cyberEqCssW && h === cyberEqCssH) return true;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        cyberEqCssW = w;
        cyberEqCssH = h;
        return true;
    }

    function cyberEqPaint(bars) {
        const cv = cyberEqCanvas;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        const W = cv.width;
        const H = cv.height;
        ctx.clearRect(0, 0, W, H);

        // Colours come from the live tokens, so the rail follows the same
        // swatches as the rest of the HUD instead of hardcoding a palette.
        const cs = getComputedStyle(cv);
        const cLow = (cs.getPropertyValue('--rt-cyber-hl') || '#00e5ff').trim();
        const cMid = (cs.getPropertyValue('--rt-accent') || '#fff200').trim();
        const cHigh = (cs.getPropertyValue('--rt-cyber-panel') || '#00e5ff').trim();
        const cPeak = (cs.getPropertyValue('--rt-glow-color') || '#fff200').trim();
        const cGrid = (cs.getPropertyValue('--rt-grid') || 'rgba(255,242,0,0.06)').trim();

        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, cLow);
        grad.addColorStop(0.5, cMid);
        grad.addColorStop(1, cHigh);

        // Baseline
        ctx.fillStyle = cGrid;
        ctx.fillRect(0, H - 1, W, 1);

        const slot = W / CYBER_EQ_BARS;
        const barW = Math.max(1, slot * 0.62);
        const pad = (slot - barW) / 2;

        ctx.fillStyle = grad;
        for (let i = 0; i < CYBER_EQ_BARS; i++) {
            const v = Math.max(0, Math.min(1, bars[i]));
            const h = Math.max(1, v * (H - 3));
            ctx.fillRect(i * slot + pad, H - h, barW, h);

            // Peak hold, decaying.
            cyberPeaks[i] = v > cyberPeaks[i] ? v : cyberPeaks[i] * 0.955;
            const ph = Math.max(1, cyberPeaks[i] * (H - 3));
            ctx.fillStyle = cPeak;
            ctx.fillRect(i * slot + pad, Math.max(0, H - ph - 2), barW, 1.5);
            ctx.fillStyle = grad;
        }
    }

    function cyberEqFrame(ts) {
        cyberEqRaf = requestAnimationFrame(cyberEqFrame);

        // Share the widget's existing FPS cap rather than adding a second
        // uncapped loop next to the games.
        const interval = typeof getFrameInterval === 'function' ? getFrameInterval() : 16.67;
        if (ts - cyberEqLastFrame < interval) return;
        cyberEqLastFrame = ts;

        if (!cyberEqCanvas || !cyberEqCanvas.isConnected) {
            cyberEqCanvas = document.getElementById('cyber-eq');
            cyberEqCssW = 0;
            if (!cyberEqCanvas) return;
        }
        if (!cyberEqResize()) return;

        const bars = cyberEqReadBars(ts);
        cyberEqUpdateBeat(bars);
        cyberEqPaint(bars);
    }

    function cyberEqStartLoop() {
        if (cyberEqRaf !== null) return;
        cyberEqCanvas = document.getElementById('cyber-eq');
        cyberEqCssW = 0;
        cyberEqLastFrame = 0;
        cyberEqRaf = requestAnimationFrame(cyberEqFrame);
    }

    function cyberEqStopLoop() {
        if (cyberEqRaf !== null) {
            cancelAnimationFrame(cyberEqRaf);
            cyberEqRaf = null;
        }
    }

    // renderFullContent() rebuilds the widget's markup, so a listener bound
    // directly to the button is orphaned on the next render and the rail goes
    // dead with no visible cause. Delegated from document instead: bound once,
    // survives every re-render.
    let cyberEqBound = false;
    let cyberEqResumed = false;

    function initCyberEq() {
        if (!cyberEqBound) {
            cyberEqBound = true;
            document.addEventListener('click', function (e) {
                const btn = e.target && e.target.closest ? e.target.closest('#cyber-eq-btn') : null;
                if (!btn) return;
                e.preventDefault();
                e.stopPropagation();
                cyberEqCycle();
            });
        }
        cyberEqUpdateButton();
        // Restore the saved source exactly once per page. Never prompts:
        // 'system' waits for a click, 'mic' only resumes on an existing grant.
        if (!cyberEqResumed) {
            cyberEqResumed = true;
            cyberEqAutoResume();
        } else if (cyberEqSource() !== 'off') {
            cyberEqStartLoop();
        }
    }

    // Full teardown. A capture stream that outlives a theme switch shows the
    // user a permanent screen-share banner for a rail that is no longer on
    // screen, so this must run on every exit path.
    function cleanupCyberAudio() {
        cyberEqStopLoop();
        cyberDetachStream();
        if (cyberAudioCtx) {
            try { cyberAudioCtx.close(); } catch (e) { /* already closed */ }
            cyberAudioCtx = null;
            cyberAnalyser = null;
            cyberFreqData = null;
        }
        cyberPeaks = new Array(CYBER_EQ_BARS).fill(0);
        cyberBassAvg = 0;
        cyberEqCanvas = null;
        cyberEqCssW = 0;
        cyberEqClearBeat();
    }
