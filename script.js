const body = document.body;
const gate = document.querySelector(".gate");
const gateSeal = document.querySelector(".gate-seal");
const weddingAudio = document.querySelector("#wedding-audio");
const musicToggle = document.querySelector(".music-toggle");
const revealItems = document.querySelectorAll(".reveal");
const navLinks = [...document.querySelectorAll(".main-nav a")];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function openInvitation() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  playWeddingSong();
  gate?.classList.add("is-open");
  body.classList.remove("is-locked");
  setTimeout(() => {
    if (gate) {
      gate.setAttribute("aria-hidden", "true");
      gate.hidden = true;
    }
  }, 1500);
}

gateSeal?.addEventListener("click", openInvitation);

function updateMusicButton() {
  if (!musicToggle || !weddingAudio) return;
  musicToggle.hidden = false;
  musicToggle.textContent = weddingAudio.paused ? "Play music" : "Pause music";
}

async function playWeddingSong() {
  if (!weddingAudio) return;

  try {
    weddingAudio.volume = 0.72;
    await weddingAudio.play();
  } catch (error) {
    // Some browsers still block audio; the visible music button lets guests retry.
  } finally {
    updateMusicButton();
  }
}

musicToggle?.addEventListener("click", async () => {
  if (!weddingAudio) return;

  if (weddingAudio.paused) {
    await playWeddingSong();
  } else {
    weddingAudio.pause();
    updateMusicButton();
  }
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14, rootMargin: "0px 0px -10% 0px" },
);

revealItems.forEach((item) => revealObserver.observe(item));

function setActiveNav() {
  const scrollPosition = window.scrollY + 180;
  let activeId = null;

  sections.forEach((section) => {
    if (section.offsetTop <= scrollPosition) {
      activeId = section.id;
    }
  });

  navLinks.forEach((link) => {
    link.classList.toggle("is-active", Boolean(activeId && link.getAttribute("href") === `#${activeId}`));
  });
}

window.addEventListener("scroll", setActiveNav, { passive: true });
window.addEventListener("resize", setActiveNav);
setActiveNav();

const weddingDate = new Date("2026-07-05T08:25:00+05:30");
const countdownTargets = {
  days: document.querySelector('[data-countdown="days"]'),
  hours: document.querySelector('[data-countdown="hours"]'),
  minutes: document.querySelector('[data-countdown="minutes"]'),
  seconds: document.querySelector('[data-countdown="seconds"]'),
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function updateCountdown() {
  const distance = Math.max(0, weddingDate.getTime() - Date.now());
  const days = Math.floor(distance / 86400000);
  const hours = Math.floor((distance % 86400000) / 3600000);
  const minutes = Math.floor((distance % 3600000) / 60000);
  const seconds = Math.floor((distance % 60000) / 1000);

  if (countdownTargets.days) countdownTargets.days.textContent = pad(days);
  if (countdownTargets.hours) countdownTargets.hours.textContent = pad(hours);
  if (countdownTargets.minutes) countdownTargets.minutes.textContent = pad(minutes);
  if (countdownTargets.seconds) countdownTargets.seconds.textContent = pad(seconds);
}

updateCountdown();
setInterval(updateCountdown, 1000);

const scratchCanvas = document.querySelector("#scratch-canvas");
const scratchButton = document.querySelector(".scratch-fallback");
const scratchContext = scratchCanvas?.getContext("2d");
let scratchActive = false;
let scratchRevealed = false;

function resizeScratchCanvas() {
  if (!scratchCanvas || !scratchContext) return;

  const rect = scratchCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  scratchCanvas.width = Math.floor(rect.width * dpr);
  scratchCanvas.height = Math.floor(rect.height * dpr);
  scratchContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintScratchCover(rect.width, rect.height);
}

function paintScratchCover(width, height) {
  if (!scratchContext || scratchRevealed) return;

  const gradient = scratchContext.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fff4bd");
  gradient.addColorStop(0.5, "#d4a445");
  gradient.addColorStop(1, "#815616");
  scratchContext.globalCompositeOperation = "source-over";
  scratchContext.fillStyle = gradient;
  scratchContext.fillRect(0, 0, width, height);
  scratchContext.fillStyle = "rgba(32, 20, 6, 0.76)";
  scratchContext.font = "700 14px Inter, Arial, sans-serif";
  scratchContext.textAlign = "center";
  scratchContext.letterSpacing = "4px";
  scratchContext.fillText("SCRATCH TO REVEAL", width / 2, height / 2);
}

function scratchAt(clientX, clientY) {
  if (!scratchCanvas || !scratchContext || scratchRevealed) return;

  const rect = scratchCanvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  scratchContext.globalCompositeOperation = "destination-out";
  scratchContext.beginPath();
  scratchContext.arc(x, y, 28, 0, Math.PI * 2);
  scratchContext.fill();
}

function revealScratchCard() {
  if (!scratchCanvas) return;
  scratchRevealed = true;
  scratchCanvas.style.opacity = "0";
  scratchCanvas.style.pointerEvents = "none";
  scratchButton?.setAttribute("hidden", "");
}

function checkScratchProgress() {
  if (!scratchCanvas || !scratchContext || scratchRevealed) return;

  const { width, height } = scratchCanvas;
  const pixels = scratchContext.getImageData(0, 0, width, height).data;
  let transparent = 0;
  const sampleStep = 24;

  for (let index = 3; index < pixels.length; index += sampleStep * 4) {
    if (pixels[index] < 32) transparent += 1;
  }

  const sampledPixels = Math.floor(pixels.length / (sampleStep * 4));
  if (transparent / sampledPixels > 0.42) {
    revealScratchCard();
  }
}

scratchCanvas?.addEventListener("pointerdown", (event) => {
  scratchActive = true;
  scratchCanvas.setPointerCapture(event.pointerId);
  scratchAt(event.clientX, event.clientY);
});

scratchCanvas?.addEventListener("pointermove", (event) => {
  if (!scratchActive) return;
  scratchAt(event.clientX, event.clientY);
});

scratchCanvas?.addEventListener("pointerup", () => {
  scratchActive = false;
  checkScratchProgress();
});

scratchCanvas?.addEventListener("pointercancel", () => {
  scratchActive = false;
});

scratchButton?.addEventListener("click", revealScratchCard);
window.addEventListener("resize", resizeScratchCanvas);
resizeScratchCanvas();

const shareButton = document.querySelector(".share-button");
shareButton?.addEventListener("click", async () => {
  const shareData = {
    title: document.title,
    text: "You are invited to Adepu Aparna and Gaddamidi Aravind's wedding celebration.",
    url: window.location.href,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(window.location.href);
    shareButton.textContent = "Copied";
  } catch (error) {
    shareButton.textContent = "Copy link";
  } finally {
    setTimeout(() => {
      shareButton.textContent = "Share";
    }, 2200);
  }
});

const rsvpForm = document.querySelector("#rsvp-form");
const formStatus = document.querySelector("#form-status");
const rsvpStorageKey = "aparna-aravind-rsvps";

function getStoredRsvps() {
  try {
    return JSON.parse(localStorage.getItem(rsvpStorageKey) || "[]");
  } catch (error) {
    return [];
  }
}

function saveStoredRsvps(entries) {
  localStorage.setItem(rsvpStorageKey, JSON.stringify(entries));
}

async function saveServerRsvp(entry) {
  try {
    const response = await fetch("/api/rsvps", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entry),
    });

    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data.saved);
  } catch (error) {
    return false;
  }
}

rsvpForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(rsvpForm);
  const name = String(data.get("name") || "").trim();
  const email = String(data.get("email") || "").trim();
  const attendance = String(data.get("attendance") || "");
  const message = String(data.get("message") || "").trim();
  const entry = {
    name,
    email,
    attendance,
    message,
    createdAt: new Date().toISOString(),
  };

  const serverSaved = await saveServerRsvp(entry);
  if (!serverSaved) {
    saveStoredRsvps([...getStoredRsvps(), entry]);
  }

  if (formStatus) {
    formStatus.textContent = `Thank you for RSVP, ${name || "dear guest"}.`;
  }

  rsvpForm.reset();
});
