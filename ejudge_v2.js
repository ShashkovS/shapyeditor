document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  // --- 1. Condition Check ---
  const checkConditions = () => {
    const mainPhraseEl = document.querySelector(".main_phrase");
    const urlParams = new URLSearchParams(window.location.search);
    if (!mainPhraseEl) return { shouldRun: false };

    const hasAssessmentText = mainPhraseEl.innerText.toLowerCase().includes('assessment');
    const hasProbId = urlParams.has('prob_id');
    const hasRunId = urlParams.has('run_id');
    const probId = urlParams.get('prob_id') || null;

    if (hasAssessmentText && (hasProbId || hasRunId)) {
      console.log("Conditions met. Initializing assessment script.");
      return { shouldRun: true, probId: probId };
    }
    return { shouldRun: false };
  };

  const { shouldRun, probId } = checkConditions();
  if (!shouldRun) return;

  // --- 2. Cheating Detection and Lockdown Logic (Always defined) ---
  const CHEATING_FLAG_KEY = `qtuTK9`;
  const BLUR_TIMESTAMP_KEY = `g9Nnft`;
  const INTERNAL_NAV_FLAG_KEY = `a4f8Hw`;

  const lockScreen = (reason) => {
    // ... (This function is unchanged)
    document.body.innerHTML = '';
    document.body.style.backgroundColor = '#2d3436';
    document.body.style.color = '#dfe6e9';
    document.body.style.display = 'flex';
    document.body.style.justifyContent = 'center';
    document.body.style.alignItems = 'center';
    document.body.style.height = '100vh';
    document.body.style.fontFamily = 'sans-serif';
    const container = document.createElement('div');
    container.style.textAlign = 'center';
    const message = document.createElement('h1');
    message.textContent = `Suspicious activity detected: ${reason}.`;
    container.appendChild(message);
    const subMessage = document.createElement('p');
    subMessage.textContent = 'Please call the teacher to enter the password.';
    container.appendChild(subMessage);
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Enter password';
    passwordInput.style.padding = '10px';
    passwordInput.style.fontSize = '1.2em';
    passwordInput.setAttribute('autocomplete', 'new-password');
    container.appendChild(passwordInput);
    const unlockButton = document.createElement('button');
    unlockButton.textContent = 'Unlock';
    unlockButton.style.padding = '10px 15px';
    unlockButton.style.marginLeft = '10px';
    container.appendChild(unlockButton);
    const handleUnlock = () => {
      if (passwordInput.value === "forgive") {
        localStorage.removeItem(CHEATING_FLAG_KEY);
        sessionStorage.removeItem(BLUR_TIMESTAMP_KEY);
        sessionStorage.removeItem(INTERNAL_NAV_FLAG_KEY);
        window.location.reload();
      } else {
        alert('Incorrect password.');
        passwordInput.value = '';
      }
    };
    unlockButton.onclick = handleUnlock;
    passwordInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleUnlock());
    document.body.appendChild(container);
    passwordInput.focus();
  };

  let hasCheatingBeenTriggered = false;
  const triggerCheatingProtocol = (reason) => {
    if (hasCheatingBeenTriggered) return;
    hasCheatingBeenTriggered = true;
    console.error(`Cheating detected: ${reason}`);
    localStorage.setItem(CHEATING_FLAG_KEY, 'true');
    lockScreen(reason);
  };

  if (localStorage.getItem(CHEATING_FLAG_KEY)) {
    lockScreen("Activity previously flagged");
    return;
  }

  // --- 3. CORE SECURITY LOGIC (Runs on ALL assessment pages) ---
  try {
    const MIN_ALLOWED_DURATION_MS = 6 * 1000;
    const MAX_ALLOWED_DURATION_MS = 60 * 60 * 1000;

    document.addEventListener('mousedown', (event) => {
      if (event.target.closest('a, button, input[type="submit"]')) {
        sessionStorage.setItem(INTERNAL_NAV_FLAG_KEY, 'true');
      }
    }, { capture: true });

    window.addEventListener('blur', () => {
      if (hasCheatingBeenTriggered) return;
      sessionStorage.setItem(BLUR_TIMESTAMP_KEY, Date.now());
    });

    window.addEventListener('focus', () => {
      const blurTimestampStr = sessionStorage.getItem(BLUR_TIMESTAMP_KEY);
      if (!blurTimestampStr) return;

      const internalNavFlag = sessionStorage.getItem(INTERNAL_NAV_FLAG_KEY);
      sessionStorage.removeItem(BLUR_TIMESTAMP_KEY);
      sessionStorage.removeItem(INTERNAL_NAV_FLAG_KEY);

      if (internalNavFlag) {
        console.log("Focus regained after an internal navigation. OK.");
        return;
      }

      const durationMs = Date.now() - parseInt(blurTimestampStr, 10);
      const durationSec = Math.round(durationMs / 1000);
      console.log(`Focus regained after external switch. Duration: ${durationSec}s.`);

      if (durationMs >= MIN_ALLOWED_DURATION_MS && durationMs <= MAX_ALLOWED_DURATION_MS) {
        triggerCheatingProtocol(`away for ${durationSec} seconds`);
      }
    });

    const devToolsCheck = setInterval(() => {
      const threshold = 160;
      if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
        clearInterval(devToolsCheck);
        triggerCheatingProtocol('Developer Tools opened');
      }
    }, 1000);

    console.log("Security listeners are active on this page.");

  } catch (error) {
    console.error("Failed to initialize core security logic:", error);
    alert("A critical security component failed to load. Please contact the teacher.");
  }

  // --- 4. CONDITIONAL IDE SETUP (Only for pages with a problem) ---
  if (probId) {
    try {
      console.log("This is a problem page. Setting up IDE.");
      const CSS_HREF = 'https://leaders.tech/shapyeditor/cssNjs/pyide.css';
      const MOD_INF = 'https://leaders.tech/shapyeditor/cssNjs/inf_course_v3.js';
      const MOD_PYIDE = 'https://leaders.tech/shapyeditor/cssNjs/pyide.js';
      const ensureLink = (href) => { if (!document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.media = 'all'; document.head.appendChild(l); } };
      const loadModule = (src) => new Promise((resolve, reject) => { const s = document.createElement('script'); s.type = 'module'; s.src = src; s.onload = () => resolve(); s.onerror = (e) => reject(new Error(`Failed to load ${src}`)); document.head.appendChild(s); });

      ensureLink(CSS_HREF);
      await Promise.all([loadModule(MOD_INF), loadModule(MOD_PYIDE)]);

      const sibling = document.getElementById("ej-submit-tabs");
      if (!sibling) throw new Error("Could not find 'ej-submit-tabs' element.");
      let ide = document.createElement('web-ide');
      sibling.parentNode.insertBefore(ide, sibling);
      await customElements.whenDefined('web-ide');
      ide._toggle();
      for (const el of document.getElementsByClassName('web-ide__toggle')) { el.remove(); }
      const textarea = document.querySelector('[name="text_form"]');
      const fileinput = document.querySelector('[name="file"]');
      const button = document.querySelector('[name="action_40"]');
      if (!textarea || !fileinput || !button) throw new Error("Required form elements not found.");
      textarea.hidden = true; textarea.setAttribute('aria-hidden', 'true'); textarea.style.display = 'none'; textarea.style.visibility = 'hidden';
      fileinput.style.display = 'none'; fileinput.style.visibility = 'hidden';
      const updateTextareaFromIDE = () => { try { const ideEl = document.querySelector('web-ide'); const ace = ideEl?._IDE?.aceEditor; if (ace) textarea.value = ace.getValue(); } catch (e) { console.error('Error reading value from IDE:', e); } };
      button.addEventListener('click', updateTextareaFromIDE, { capture: true });
      const oldOnClick = button.onclick;
      if (typeof oldOnClick === 'function') { button.onclick = function wrappedOnclick(ev) { updateTextareaFromIDE(); return oldOnClick.call(this, ev); }; } else { button.onclick = function submitFallback() { updateTextareaFromIDE(); const form = button.form || button.closest('form'); if (form) { if (typeof form.requestSubmit === 'function') form.requestSubmit(button); else form.submit(); } }; }

      console.log("IDE setup complete.");
    } catch (error) {
      console.error("An error occurred during IDE initialization:", error);
      alert("Failed to initialize the code editor. Please contact the teacher.");
    }
  }
});



