/**
 * Legacy Bible Church — main.js
 * Vanilla JS — no dependencies
 */

(function () {
  'use strict';

  /* ============================================================
     HELPERS
     ============================================================ */

  /**
   * Run a callback once the DOM is ready.
   * If it's already loaded, call immediately.
   */
  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  /**
   * Select one element.
   * @param {string} selector
   * @param {Element} [ctx=document]
   * @returns {Element|null}
   */
  function $(selector, ctx) {
    return (ctx || document).querySelector(selector);
  }

  /**
   * Select all matching elements as an Array.
   * @param {string} selector
   * @param {Element} [ctx=document]
   * @returns {Element[]}
   */
  function $$(selector, ctx) {
    return Array.from((ctx || document).querySelectorAll(selector));
  }

  /* ============================================================
     1. MOBILE NAV
     ============================================================ */
  function initMobileNav() {
    var hamburger  = $('.hamburger');
    var mobileMenu = $('.mobile-menu');

    if (!hamburger || !mobileMenu) return;

    // Toggle open / closed
    function toggleMenu(force) {
      var isOpen = typeof force === 'boolean'
        ? force
        : !hamburger.classList.contains('open');

      hamburger.classList.toggle('open', isOpen);
      mobileMenu.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    hamburger.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });

    // Close when a link inside the mobile menu is clicked
    $$('.mobile-menu-link, .mobile-menu-cta', mobileMenu).forEach(function (link) {
      link.addEventListener('click', function () {
        toggleMenu(false);
      });
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (
        mobileMenu.classList.contains('open') &&
        !mobileMenu.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        toggleMenu(false);
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        toggleMenu(false);
        hamburger.focus();
      }
    });

    // Accessibility
    hamburger.setAttribute('aria-label', 'Toggle navigation menu');
    hamburger.setAttribute('aria-controls', 'mobile-menu');
    hamburger.setAttribute('aria-expanded', 'false');
    if (!mobileMenu.id) mobileMenu.id = 'mobile-menu';
  }

  /* ============================================================
     2. ACTIVE NAV LINK
     ============================================================ */
  function initActiveNavLink() {
    var currentPath = window.location.pathname;

    // Normalize trailing slashes and index files
    function normalizePath(p) {
      return p
        .replace(/\/index\.html?$/, '/')
        .replace(/\/$/, '')
        .toLowerCase()
        || '/';
    }

    var normalCurrent = normalizePath(currentPath);

    // Desktop nav links
    $$('.nav-link').forEach(function (link) {
      var linkPath = normalizePath(new URL(link.href, window.location.origin).pathname);
      var isActive = linkPath === normalCurrent ||
                     (linkPath !== '' && linkPath !== '/' && normalCurrent.startsWith(linkPath));
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
    });

    // Mobile menu links
    $$('.mobile-menu-link').forEach(function (link) {
      var linkPath = normalizePath(new URL(link.href, window.location.origin).pathname);
      var isActive = linkPath === normalCurrent ||
                     (linkPath !== '' && linkPath !== '/' && normalCurrent.startsWith(linkPath));
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
    });
  }

  /* ============================================================
     3. SMOOTH SCROLL (anchor links)
     ============================================================ */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;

      var hash = link.getAttribute('href');
      if (hash === '#' || hash === '#!') return;

      var target = document.getElementById(hash.slice(1));
      if (!target) return;

      e.preventDefault();

      var navHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--nav-height') || '72',
        10
      );

      var targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight - 12;

      window.scrollTo({ top: targetTop, behavior: 'smooth' });

      // Update URL hash without jumping
      if (history.pushState) {
        history.pushState(null, '', hash);
      }
    });
  }

  /* ============================================================
     4. SCROLL-BASED NAV (.scrolled class)
     ============================================================ */
  function initScrolledNav() {
    var nav = $('.nav');
    if (!nav) return;

    var threshold = 50;
    var ticking   = false;

    function updateNav() {
      nav.classList.toggle('scrolled', window.scrollY > threshold);
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(updateNav);
        ticking = true;
      }
    }, { passive: true });

    // Run once on load
    updateNav();
  }

  /* ============================================================
     5. BUTTON RIPPLE EFFECT
     ============================================================ */
  function initRipple() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn');
      if (!btn) return;

      var rect   = btn.getBoundingClientRect();
      var size   = Math.max(rect.width, rect.height) * 2;
      var x      = e.clientX - rect.left - size / 2;
      var y      = e.clientY - rect.top  - size / 2;

      var ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.cssText = [
        'width:'  + size + 'px',
        'height:' + size + 'px',
        'left:'   + x + 'px',
        'top:'    + y + 'px'
      ].join(';');

      btn.appendChild(ripple);

      setTimeout(function () {
        ripple.remove();
      }, 600);
    });
  }

  /* ============================================================
     6. SCROLL REVEAL (fade-up + timeline steps)
     ============================================================ */
  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: make everything visible immediately
      $$('.reveal, .timeline-step').forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '0px 0px -60px 0px',
        threshold: 0.08
      }
    );

    $$('.reveal, .timeline-step').forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ============================================================
     7. AUTO-ASSIGN REVEAL DELAYS (stagger card grids)
     ============================================================ */
  function initRevealDelays() {
    var gridSelectors = [
      '.grid',
      '.card-grid',
      '.sermon-grid',
      '.event-grid',
      '.ministry-grid',
      '.series-grid'
    ];

    gridSelectors.forEach(function (sel) {
      $$(sel).forEach(function (grid) {
        var revealChildren = $$('.reveal', grid);
        revealChildren.forEach(function (child, i) {
          // Only assign delays 1–5; beyond that leave un-delayed
          var delay = Math.min(i + 1, 5);
          child.classList.add('reveal-delay-' + delay);
        });
      });
    });
  }

  /* ============================================================
     8. FADE-IN ON SCROLL (legacy .fade-in / .stagger classes)
     ============================================================ */
  function initFadeIn() {
    if (!('IntersectionObserver' in window)) {
      $$('.fade-in, .stagger').forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '0px 0px -60px 0px',
        threshold: 0.08
      }
    );

    $$('.fade-in, .stagger').forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ============================================================
     9. GIVE SECTION — amount & frequency toggles
     ============================================================ */
  function initGiveSection() {
    // Amount buttons
    $$('.give-amount-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.give-amount-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');

        // Populate custom input with the chosen value (strip $ sign)
        var customInput = $('.give-custom-input input');
        if (customInput) {
          customInput.value = btn.textContent.replace(/[^0-9.]/g, '');
        }
      });
    });

    // Frequency buttons
    $$('.give-freq-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.give-freq-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
    });

    // Deselect preset when user types a custom amount
    var customInput = $('.give-custom-input input');
    if (customInput) {
      customInput.addEventListener('input', function () {
        $$('.give-amount-btn').forEach(function (b) { b.classList.remove('selected'); });
      });
    }
  }

  /* ============================================================
     10. SERMON CARD — play button
     ============================================================ */
  function initSermonCards() {
    $$('.sermon-card').forEach(function (card) {
      var playBtn = $('.sermon-play-btn', card);
      if (!playBtn) return;

      playBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var title = ($('.sermon-title', card) || {}).textContent || 'Sermon';
        // Dispatch a custom event that a player widget can listen to
        card.dispatchEvent(
          new CustomEvent('sermon:play', {
            bubbles: true,
            detail: {
              title: title,
              card: card
            }
          })
        );
      });
    });
  }

  /* ============================================================
     11. ANNOUNCEMENT BAR — dismiss
     ============================================================ */
  function initAnnouncementBar() {
    var bar = $('.announcement-bar');
    if (!bar) return;

    var dismissBtn = $('.announcement-bar [data-dismiss]', bar);
    if (!dismissBtn) return;

    dismissBtn.addEventListener('click', function () {
      bar.style.height    = bar.offsetHeight + 'px';
      bar.style.overflow  = 'hidden';
      bar.style.transition = 'height 0.25s ease, opacity 0.25s ease';

      requestAnimationFrame(function () {
        bar.style.height  = '0';
        bar.style.opacity = '0';
      });

      bar.addEventListener('transitionend', function () {
        bar.remove();
      }, { once: true });
    });
  }

  /* ============================================================
     12. FORM VALIDATION — connect form (data-validate)
     ============================================================ */
  function initForms() {
    $$('form[data-validate]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        var valid = true;

        // Clear previous errors
        $$('.form-error', form).forEach(function (err) { err.remove(); });
        $$('.form-input, .form-textarea, .form-select', form).forEach(function (field) {
          field.style.borderColor = '';
        });

        // Required fields
        $$('[required]', form).forEach(function (field) {
          if (!field.value.trim()) {
            valid = false;
            showFieldError(field, 'This field is required.');
          }
        });

        // Email fields
        $$('[type="email"]', form).forEach(function (field) {
          if (field.value && !isValidEmail(field.value)) {
            valid = false;
            showFieldError(field, 'Please enter a valid email address.');
          }
        });

        if (!valid) {
          e.preventDefault();
          // Focus first error
          var firstError = $('.form-error', form);
          if (firstError && firstError.previousElementSibling) {
            firstError.previousElementSibling.focus();
          }
        }
      });
    });
  }

  function showFieldError(field, message) {
    field.style.borderColor = '#c05050';
    var err = document.createElement('span');
    err.className = 'form-error';
    err.style.cssText = 'display:block;color:#c05050;font-size:0.8rem;margin-top:4px;';
    err.textContent = message;
    field.parentNode.insertBefore(err, field.nextSibling);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ============================================================
     13. SERMON NOTIFY FORM — replace with thank-you message
     ============================================================ */
  function initSermonNotifyForm() {
    var form = $('.sermon-notify-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var wrapper = form.parentNode;
      var thankyou = document.createElement('p');
      thankyou.style.cssText = 'color:var(--accent-bright);font-size:1rem;padding:16px 0;';
      thankyou.textContent = "Thanks! We'll let you know.";

      wrapper.replaceChild(thankyou, form);
    });
  }

  /* ============================================================
     14. COPY TO CLIPBOARD (for address, etc.)
     ============================================================ */
  function initCopyButtons() {
    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy') || btn.textContent;
        navigator.clipboard.writeText(text.trim()).then(function () {
          var original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(function () {
            btn.textContent = original;
          }, 1800);
        }).catch(function () {
          // Fallback for older browsers
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity  = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        });
      });
    });
  }

  /* ============================================================
     15. LAZY LOAD IMAGES (data-src → src)
     ============================================================ */
  function initLazyImages() {
    if (!('IntersectionObserver' in window)) return;

    var imgObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var img = entry.target;
          var src = img.getAttribute('data-src');
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
          }
          imgObserver.unobserve(img);
        });
      },
      { rootMargin: '200px 0px' }
    );

    $$('img[data-src]').forEach(function (img) {
      imgObserver.observe(img);
    });
  }

  /* ============================================================
     16. BACK TO TOP BUTTON
     ============================================================ */
  function initBackToTop() {
    var btn = $('.back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', function () {
      btn.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ============================================================
     17. STICKY SECTION HIGHLIGHT
         (Highlights nav items as their section enters view)
     ============================================================ */
  function initSectionSpy() {
    var sections = $$('section[id], div[id][data-section]');
    if (!sections.length) return;

    var navLinks = $$('.nav-link[href^="#"], .mobile-menu-link[href^="#"]');
    if (!navLinks.length) return;

    var navHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-height') || '72',
      10
    );

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.id;
          navLinks.forEach(function (link) {
            var href = link.getAttribute('href');
            var matches = href === '#' + id;
            link.classList.toggle('active', matches);
            if (matches) {
              link.setAttribute('aria-current', 'true');
            } else {
              link.removeAttribute('aria-current');
            }
          });
        });
      },
      {
        rootMargin: '-' + navHeight + 'px 0px -60% 0px',
        threshold: 0
      }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  /* ============================================================
     18. BLUR SCROLL — bidirectional blur as elements enter/leave
     ============================================================ */
  function initBlurScroll() {
    if (!('IntersectionObserver' in window)) return;

    // Same content blocks the auto-reveal targets, plus the hero inner
    var selectors = [
      '.section-header',
      '.prose',
      '.two-col__text',
      '.two-col__media',
      '.series-card',
      '.scripture-block',
      '.notify-form',
      '.contact-form',
      '.faq-list',
      '.qr-wrapper',
      '.hero-inner',
      '.card-grid'
    ];

    var targets = [];
    selectors.forEach(function (sel) {
      $$(sel).forEach(function (el) {
        el.classList.add('blur-scroll');
        targets.push(el);
      });
    });

    if (!targets.length) return;

    // 21 thresholds gives smooth interpolation
    var thresholds = [];
    for (var i = 0; i <= 20; i++) thresholds.push(i / 20);

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var ratio = entry.intersectionRatio;
        // Fully unblurred at 35%+ visible; max 7px blur when invisible
        var progress = Math.min(ratio / 0.35, 1);
        var blur = 7 * (1 - progress);
        entry.target.style.filter = 'blur(' + blur.toFixed(2) + 'px)';
      });
    }, { threshold: thresholds });

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ============================================================
     19. PAGE TRANSITION (fade in on load, fade out on navigate)
     ============================================================ */
  function initPageTransition() {
    // Fade in is handled by CSS on body

    // Fade out before navigating to another page
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href]');
      if (!link) return;

      var href = link.getAttribute('href');
      if (!href) return;
      // Skip anchors, external links, mailto, tel, blank targets
      if (
        href.charAt(0) === '#' ||
        href.startsWith('http') ||
        href.startsWith('mailto') ||
        href.startsWith('tel') ||
        link.target === '_blank'
      ) return;

      e.preventDefault();
      document.body.classList.add('page-exit');
      setTimeout(function () {
        window.location.href = href;
      }, 280);
    });
  }

  /* ============================================================
     20. AUTO-APPLY REVEAL CLASS TO SECTIONS & CARDS
     ============================================================ */
  function initAutoReveal() {
    // Elements to fade up on scroll
    var selectors = [
      '.section-header',
      '.prose',
      '.two-col__text',
      '.two-col__media',
      '.series-card',
      '.scripture-block',
      '.notify-form',
      '.contact-form',
      '.faq-list',
      '.qr-wrapper',
      '.section-footer-text'
    ];

    selectors.forEach(function (sel) {
      $$(sel).forEach(function (el) {
        if (!el.classList.contains('reveal')) {
          el.classList.add('reveal');
        }
      });
    });

    // Stagger cards inside grids
    $$('.card-grid').forEach(function (grid) {
      $$('.card', grid).forEach(function (card, i) {
        if (!card.classList.contains('reveal')) {
          card.classList.add('reveal');
        }
        card.style.transitionDelay = (i * 0.07) + 's';
      });
    });
  }

  /* ============================================================
     INIT — run everything
     ============================================================ */
  ready(function () {
    initMobileNav();
    initActiveNavLink();
    initSmoothScroll();
    initScrolledNav();
    initRipple();
    initAutoReveal();       // assign reveal classes before observing
    initBlurScroll();       // blur/unblur as elements enter/leave viewport
    initScrollReveal();
    initRevealDelays();
    initFadeIn();
    initPageTransition();
    initGiveSection();
    initSermonCards();
    initAnnouncementBar();
    initForms();
    initSermonNotifyForm();
    initCopyButtons();
    initLazyImages();
    initBackToTop();
    initSectionSpy();
  });

})();
