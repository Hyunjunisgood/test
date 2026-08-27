/* ============================================================
   전자기학 — Interactive Script
   Electric Field Visualization + Interactions
   ============================================================ */

(function () {
  'use strict';

  /* ---------- DOM Elements ---------- */
  const canvas = document.getElementById('fieldViz');
  const ctx = canvas.getContext('2d');
  const vizContainer = canvas.parentElement;
  const hint = document.getElementById('vizHint');
  const hintToggle = document.getElementById('vizHintToggle');
  const clearBtn = document.getElementById('clearChargeBtn');
  const toggleLinesBtn = document.getElementById('toggleFieldLinesBtn');
  const wavelengthSlider = document.getElementById('wavelengthSlider');
  const sliderWavelength = document.getElementById('sliderWavelength');
  const sliderRegion = document.getElementById('sliderRegion');
  const spectrumMarker = document.getElementById('spectrumMarker');
  const menuBtn = document.getElementById('menuBtn');
  const mainNav = document.getElementById('mainNav');
  const scrollProgress = document.getElementById('scrollProgress');
  const progressBar = scrollProgress.querySelector('.scroll-progress-bar');
  const header = document.querySelector('header');
  const navLinks = document.querySelectorAll('.nav-list a');

  /* ---------- Canvas Setup ---------- */
  let W, H;

  function resizeCanvas() {
    const rect = vizContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    W = rect.width;
    H = Math.min(500, W * 0.55);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawField();
  }

  /* ---------- Charges ---------- */
  const charges = [];
  let showFieldLines = true;

  const MAX_CHARGES = 8;

  class Charge {
    constructor(x, y, type) {
      this.x = x;
      this.y = y;
      this.type = type; // 'positive' or 'negative'
      this.radius = 14;
      this.selected = false;
    }

    draw() {
      const isPos = this.type === 'positive';
      const color = isPos ? '#00c9ff' : '#ef4444';
      const glowColor = isPos ? 'rgba(0,201,255,0.4)' : 'rgba(239,68,68,0.4)';

      // Glow
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2.5);
      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Main circle
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Inner circle
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = isPos ? '#fff' : '#1a1a1a';
      ctx.fill();

      // Selection ring
      if (this.selected) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Symbol
      ctx.fillStyle = isPos ? '#000' : '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isPos ? '+' : '−', this.x, this.y + 1);
    }

    contains(px, py) {
      const dx = px - this.x;
      const dy = py - this.y;
      return Math.sqrt(dx * dx + dy * dy) <= this.radius + 5;
    }
  }

  /* ---------- Electric Field Calculation ---------- */
  function calculateField(x, y, ignoreCharge) {
    let Ex = 0;
    let Ey = 0;
    const k = 50000; // Field strength constant

    for (const charge of charges) {
      if (charge === ignoreCharge) continue;
      const dx = x - charge.x;
      const dy = y - charge.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 1) continue;

      const dist = Math.sqrt(distSq);
      const magnitude = k / distSq;

      // Sign: positive charge pushes away (positive direction), negative pulls toward
      const sign = charge.type === 'positive' ? 1 : -1;

      Ex += sign * magnitude * (dx / dist);
      Ey += sign * magnitude * (dy / dist);
    }

    return { x: Ex, y: Ey };
  }

  /* ---------- Field Line Tracing ---------- */
  function traceFieldLine(startX, startY, direction, steps, stepSize) {
    const points = [];
    let x = startX;
    let y = startY;

    for (let i = 0; i < steps; i++) {
      const field = calculateField(x, y, null);
      let fx = field.x;
      let fy = field.y;
      const mag = Math.sqrt(fx * fx + fy * fy);

      if (mag < 0.001) break;

      // Determine direction
      const dirX = direction === 'outward' ? 1 : -1;
      fx *= dirX;
      fy *= dirX;

      // Normalize
      fx /= mag;
      fy /= mag;

      x += fx * stepSize;
      y += fy * stepSize;

      // Check bounds
      if (x < 0 || x > W || y < 0 || y > H) break;

      // Check if too close to a charge (other than starting)
      let tooClose = false;
      for (const charge of charges) {
        if (charge === null) continue;
        const dx = x - charge.x;
        const dy = y - charge.y;
        if (Math.sqrt(dx * dx + dy * dy) < charge.radius + 2) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) break;

      points.push({ x, y });

      // Also check if we should stop tracing (reached another charge)
      if (points.length > 5) {
        let hitCharge = false;
        for (const charge of charges) {
          if (charge === null) continue;
          const dx = x - charge.x;
          const dy = y - charge.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < charge.radius + 3) {
            hitCharge = true;
            break;
          }
        }
        if (hitCharge && direction === 'outward') break;
      }
    }

    return points;
  }

  /* ---------- Drawing ---------- */
  function drawField() {
    // Clear
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);

    if (charges.length === 0) {
      // Draw hint text on canvas
      ctx.fillStyle = 'rgba(240,240,245,0.3)';
      ctx.font = '14px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('전하를 드래그하여 배치하세요', W / 2, H / 2);
      return;
    }

    // Draw field lines
    if (showFieldLines) {
      drawFieldLines();
    }

    // Draw charges
    for (const charge of charges) {
      charge.draw();
    }

    // Draw charge connections (for visual effect)
    if (charges.length > 1) {
      for (let i = 0; i < charges.length; i++) {
        for (let j = i + 1; j < charges.length; j++) {
          const c1 = charges[i];
          const c2 = charges[j];
          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            const grad = ctx.createLinearGradient(c1.x, c1.y, c2.x, c2.y);
            if (c1.type !== c2.type) {
              grad.addColorStop(0, 'rgba(0,201,255,0.1)');
              grad.addColorStop(0.5, 'rgba(157,78,221,0.2)');
              grad.addColorStop(1, 'rgba(239,68,68,0.1)');
            } else {
              grad.addColorStop(0, 'rgba(0,201,255,0.05)');
              grad.addColorStop(1, 'rgba(0,201,255,0.05)');
            }
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
    }
  }

  function drawFieldLines() {
    const steps = 80;
    const stepSize = 8;
    const linesPerCharge = 12;

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(240,240,245,0.15)';

    for (const charge of charges) {
      const angleStep = (Math.PI * 2) / linesPerCharge;

      for (let i = 0; i < linesPerCharge; i++) {
        const angle = angleStep * i + (charge.type === 'positive' ? 0 : Math.PI);
        const startX = charge.x + Math.cos(angle) * (charge.radius + 2);
        const startY = charge.y + Math.sin(angle) * (charge.radius + 2);

        const direction = charge.type === 'positive' ? 'outward' : 'inward';
        const line = traceFieldLine(startX, startY, direction, steps, stepSize);

        if (line.length > 5) {
          ctx.beginPath();
          ctx.moveTo(line[0].x, line[0].y);
          for (let j = 1; j < line.length; j++) {
            ctx.lineTo(line[j].x, line[j].y);
          }
          ctx.stroke();
        }
      }
    }

    // Draw some additional field lines between charges for visual continuity
    if (charges.length >= 2) {
      for (let i = 0; i < charges.length; i++) {
        for (let j = i + 1; j < charges.length; j++) {
          const c1 = charges[i];
          const c2 = charges[j];

          // Sample midpoint
          const midX = (c1.x + c2.x) / 2;
          const midY = (c1.y + c2.y) / 2;

          const field = calculateField(midX, midY, null);
          const mag = Math.sqrt(field.x * field.x + field.y * field.y);

          if (mag > 0.1) {
            const normalize = 1 / mag;
            const perpX = -field.y * normalize;
            const perpY = field.x * normalize;

            // Draw a few lines through midpoint
            const offsets = [-20, 0, 20];
            for (const offset of offsets) {
              const startX = midX + perpX * offset;
              const startY = midY + perpY * offset;

              const line = traceFieldLine(startX, startY, field.x > 0 ? 'outward' : 'inward', steps, stepSize);

              if (line.length > 3) {
                ctx.beginPath();
                ctx.moveTo(line[0].x, line[0].y);
                for (let k = 1; k < line.length; k++) {
                  ctx.lineTo(line[k].x, line[k].y);
                }
                ctx.strokeStyle = 'rgba(240,240,245,0.08)';
                ctx.stroke();
              }
            }
          }
        }
      }
    }
  }

  /* ---------- Charge Placement ---------- */
  function addCharge(x, y, type) {
    if (charges.length >= MAX_CHARGES) {
      // Remove oldest charge
      const removed = charges.shift();
      // Adjust selected index if needed
    }
    charges.push(new Charge(x, y, type));
    drawField();
  }

  function getChargeAt(x, y) {
    for (let i = charges.length - 1; i >= 0; i--) {
      if (charges[i].contains(x, y)) {
        return charges[i];
      }
    }
    return null;
  }

  /* ---------- Mouse/Touch Events ---------- */
  let isDragging = false;
  let dragCharge = null;
  let dragOffset = { x: 0, y: 0 };
  let pendingType = 'positive';

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function handlePointerDown(e) {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    const charge = getChargeAt(coords.x, coords.y);

    if (charge) {
      isDragging = true;
      dragCharge = charge;
      dragOffset.x = coords.x - charge.x;
      dragOffset.y = coords.y - charge.y;
      charge.selected = true;
      drawField();
    } else {
      // Check for modifier keys for charge type
      const isNegative = e.shiftKey || e.ctrlKey || e.metaKey;
      pendingType = isNegative ? 'negative' : 'positive';
      addCharge(coords.x, coords.y, pendingType);
    }
  }

  function handlePointerMove(e) {
    e.preventDefault();
    const coords = getCanvasCoords(e);

    if (isDragging && dragCharge) {
      dragCharge.x = Math.max(0, Math.min(W, coords.x - dragOffset.x));
      dragCharge.y = Math.max(0, Math.min(H, coords.y - dragOffset.y));
      drawField();
    }
  }

  function handlePointerUp(e) {
    if (isDragging && dragCharge) {
      dragCharge.selected = false;
    }
    isDragging = false;
    dragCharge = null;
    drawField();
  }

  // Mouse events
  canvas.addEventListener('mousedown', handlePointerDown);
  canvas.addEventListener('mousemove', handlePointerMove);
  canvas.addEventListener('mouseup', handlePointerUp);
  canvas.addEventListener('mouseleave', handlePointerUp);

  // Touch events
  canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
  canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
  canvas.addEventListener('touchend', handlePointerUp, { passive: false });

  // Keyboard for charge type
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      pendingType = 'negative';
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      pendingType = 'positive';
    }
  });

  /* ---------- Controls ---------- */
  clearBtn.addEventListener('click', () => {
    charges.length = 0;
    drawField();
  });

  toggleLinesBtn.addEventListener('click', () => {
    showFieldLines = !showFieldLines;
    toggleLinesBtn.textContent = showFieldLines ? '장선 토글' : '장선 표시';
    drawField();
  });

  hintToggle.addEventListener('click', () => {
    hint.style.display = 'none';
  });

  /* ---------- Spectrum Slider ---------- */
  const spectrumData = [
    { label: '라디오파', wavelength: '> 1 m', region: '라디오파', color: '#1a5cff' },
    { label: '마이크로파', wavelength: '1 mm – 1 m', region: '마이크로파', color: '#2d7aff' },
    { label: '적외선', wavelength: '700 nm – 1 mm', region: '적외선', color: '#4da6ff' },
    { label: '가시광선', wavelength: '400 – 700 nm', region: '가시광선', color: '#fbbf24' },
    { label: '자외선', wavelength: '10 – 400 nm', region: '자외선', color: '#a78bfa' },
    { label: 'X선', wavelength: '0.01 – 10 nm', region: 'X선', color: '#8b5cf6' },
    { label: '감마선', wavelength: '< 0.01 nm', region: '감마선', color: '#ec4899' },
  ];

  function updateSpectrum(value) {
    const percent = value / 100;
    const segmentWidth = 100 / spectrumData.length;
    const segmentIndex = Math.min(Math.floor(percent * spectrumData.length), spectrumData.length - 1);

    // Update marker position
    const markerPercent = percent * 100;
    spectrumMarker.style.left = markerPercent + '%';

    // Update info display
    const data = spectrumData[segmentIndex];
    sliderRegion.textContent = data.region;
    sliderRegion.style.color = data.color;

    // Update wavelength display
    let wavelengthDisplay;
    if (segmentIndex === 0) {
      wavelengthDisplay = '> 1 m';
    } else if (segmentIndex === spectrumData.length - 1) {
      wavelengthDisplay = '< 0.01 nm';
    } else {
      const startIdx = segmentIndex === 0 ? 0 : segmentIndex - 1;
      const startData = spectrumData[startIdx];
      const endData = spectrumData[segmentIndex];

      // Estimate wavelength based on position within segment
      const localPercent = (percent * spectrumData.length) % 1;
      // Simplified display
      wavelengthDisplay = data.wavelength;
    }
    sliderWavelength.textContent = wavelengthDisplay;

    // Highlight active segment
    document.querySelectorAll('.spectrum-segment').forEach((seg, i) => {
      seg.classList.toggle('spectrum-segment--active', i === segmentIndex);
    });
  }

  wavelengthSlider.addEventListener('input', (e) => {
    updateSpectrum(e.target.value);
  });

  // Initialize spectrum
  updateSpectrum(60);
  wavelengthSlider.value = 60;

  /* ---------- Mobile Menu ---------- */
  menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('active');
    mainNav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', mainNav.classList.contains('open'));
  });

  // Close menu on link click
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      menuBtn.classList.remove('active');
      mainNav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    if (mainNav.classList.contains('open') &&
        !mainNav.contains(e.target) &&
        !menuBtn.contains(e.target)) {
      menuBtn.classList.remove('active');
      mainNav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /* ---------- Scroll Progress ---------- */
  function updateScrollProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = progress + '%';
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  /* ---------- Header Scroll Effect ---------- */
  function handleHeaderScroll() {
    if (window.scrollY > 100) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleHeaderScroll, { passive: true });

  /* ---------- Active Nav Link ---------- */
  function updateActiveNav() {
    const scrollPos = window.scrollY + 200;

    navLinks.forEach(link => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        const targetTop = target.offsetTop;
        const targetBottom = targetTop + target.offsetHeight;

        if (scrollPos >= targetTop && scrollPos < targetBottom) {
          navLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });

  /* ---------- Timeline Visibility ---------- */
  const tlNodes = document.querySelectorAll('.tl-node');

  function updateTimelineVisibility() {
    tlNodes.forEach(node => {
      const rect = node.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight - 100 && rect.bottom > 100;
      node.classList.toggle('visible', isVisible);
    });
  }

  window.addEventListener('scroll', updateTimelineVisibility, { passive: true });

  /* ---------- Scroll Reveal ---------- */
  const revealElements = document.querySelectorAll('.reveal');

  function checkReveal() {
    revealElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight - 50 && rect.bottom > 50;
      el.classList.toggle('visible', isVisible);
    });
  }

  // Observe new elements
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '50px' });

  revealElements.forEach(el => observer.observe(el));

  /* ---------- Initialize ---------- */
  function init() {
    resizeCanvas();

    // Initial reveal check
    setTimeout(checkReveal, 100);

    // Update on scroll
    window.addEventListener('scroll', checkReveal, { passive: true });

    // Resize handler
    window.addEventListener('resize', resizeCanvas);
  }

  // Wait for DOM
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

})();
