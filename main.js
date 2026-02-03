/* ==========================================================================
   ALEXANDAR PAVLOV PORTFOLIO — JAVASCRIPT
   Scroll Reveal + Smooth Scroll + Form Handling
   ========================================================================== */

(function () {
  "use strict";

  // ==========================================================================
  // 1. SCROLL REVEAL ANIMATION
  // ==========================================================================

  /**
   * Initialize IntersectionObserver for scroll reveal animations
   */
  function initScrollReveal() {
    const revealElements = document.querySelectorAll(".reveal");

    if (!revealElements.length) return;

    const observerOptions = {
      root: null,
      rootMargin: "0px 0px -100px 0px",
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          // Unobserve after revealing to improve performance
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    revealElements.forEach((element) => {
      observer.observe(element);
    });
  }

  // ==========================================================================
  // 2. SMOOTH SCROLL FOR ANCHOR LINKS
  // ==========================================================================

  /**
   * Handle smooth scrolling for navigation links
   */
  function initSmoothScroll() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');

    anchorLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        const targetId = link.getAttribute("href");

        // Skip if it's just "#" or empty
        if (targetId === "#" || !targetId) return;

        const targetElement = document.querySelector(targetId);

        if (targetElement) {
          e.preventDefault();

          // Calculate offset for fixed navbar
          const navbarHeight = 120;
          const targetPosition =
            targetElement.getBoundingClientRect().top +
            window.pageYOffset -
            navbarHeight;

          window.scrollTo({
            top: targetPosition,
            behavior: "smooth",
          });

          // Update URL without jumping
          history.pushState(null, null, targetId);
        }
      });
    });
  }

  // ==========================================================================
  // 3. ACTIVE NAVIGATION STATE
  // ==========================================================================

  /**
   * Highlight active navigation link based on scroll position
   */
  function initActiveNavigation() {
    const sections = document.querySelectorAll("section[id]");
    const navLinks = document.querySelectorAll(".nav-link");

    if (!sections.length || !navLinks.length) return;

    function updateActiveLink() {
      const scrollPosition = window.scrollY + 200;

      sections.forEach((section) => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute("id");

        if (
          scrollPosition >= sectionTop &&
          scrollPosition < sectionTop + sectionHeight
        ) {
          navLinks.forEach((link) => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${sectionId}`) {
              link.classList.add("active");
            }
          });
        }
      });
    }

    // Throttle scroll event for performance
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActiveLink();
          ticking = false;
        });
        ticking = true;
      }
    });

    // Initial check
    updateActiveLink();
  }

  // ==========================================================================
  // 4. FORM HANDLING
  // ==========================================================================

  /**
   * Basic form validation and submission handling
   * Opens user's email client with pre-filled message
   */
  function initFormHandling() {
    const form = document.getElementById("contact-form");

    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // Get form data
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);

      // Basic validation
      const errors = validateForm(data);

      if (errors.length > 0) {
        // Show errors
        alert(errors.join('\n'));
        return;
      }

      // Submit to Web3Forms via fetch
      const submitBtn = form.querySelector('button[type="submit"]');
      
      // Store original content
      if (!submitBtn.hasAttribute('data-original-content')) {
        submitBtn.setAttribute('data-original-content', submitBtn.innerHTML);
      }
      
      // Update UI to Loading
      submitBtn.classList.add('loading');
      submitBtn.innerHTML = `
        <div class="loading-container">
            <svg class="progress-ring" viewBox="0 0 36 36">
                <circle class="progress-ring__circle" cx="18" cy="18" r="15.915"/>
            </svg>
            <span class="spinner-checkmark"></span>
        </div>
      `;
      submitBtn.disabled = true;

      // Minimum animation time promise
      const minAnimationTime = new Promise(resolve => setTimeout(resolve, 1000));
      
      // API request promise
      const apiRequest = fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });

      // Wait for BOTH to complete
      Promise.all([apiRequest, minAnimationTime])
      .then(async ([response]) => {
        const json = await response.json();
        
        if (response.status === 200) {
          // Success
          submitBtn.classList.remove('loading');
          submitBtn.classList.add('success');
          submitBtn.innerHTML = 'Thanks for applying 💙';
          
          // Reset form
          form.reset();
          
          // Restore button after delay
          setTimeout(() => {
            submitBtn.classList.remove('success');
            submitBtn.innerHTML = submitBtn.getAttribute('data-original-content');
            submitBtn.disabled = false;
          }, 3000);
          
        } else {
          // Error handling
          console.error(json);
          throw new Error(json.message || 'Something went wrong');
        }
      })
      .catch(error => {
        console.error(error);
        alert(error.message || 'Something went wrong. Please try again.');
        
        submitBtn.classList.remove('loading');
        submitBtn.innerHTML = submitBtn.getAttribute('data-original-content');
        submitBtn.disabled = false;
      });
    });
  }

  /**
   * Validate form data
   * @param {Object} data - Form data object
   * @returns {Array} Array of error messages
   */
  function validateForm(data) {
    const errors = [];

    if (!data.name || data.name.trim().length < 2) {
      errors.push("Please enter your full name");
    }

    if (!data.email || !isValidEmail(data.email)) {
      errors.push("Please enter a valid email address");
    }

    if (!data.service) {
      errors.push("Please select a service");
    }

    if (!data.message || data.message.trim().length < 10) {
      errors.push("Please tell us more about your project");
    }

    return errors;
  }

  /**
   * Validate email format
   * @param {string} email - Email address to validate
   * @returns {boolean} Whether email is valid
   */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ==========================================================================
  // 5. NAVBAR SCROLL EFFECT
  // ==========================================================================

  /**
   * Add/remove class on navbar based on scroll position
   */
  function initNavbarScroll() {
    const navbar = document.querySelector(".navbar");

    if (!navbar) return;

    function updateNavbar() {
      if (window.scrollY > 100) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    }

    // Throttle scroll event
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateNavbar();
          ticking = false;
        });
        ticking = true;
      }
    });

    // Initial check
    updateNavbar();
  }

  // ==========================================================================
  // 6. INITIALIZE
  // ==========================================================================

  /**
   * Initialize all modules when DOM is ready
   */
  function init() {
    initScrollReveal();
    initSmoothScroll();
    initActiveNavigation();
    initFormHandling();
    initNavbarScroll();
  }

  // Run init when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
