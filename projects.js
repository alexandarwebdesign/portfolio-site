/* ==========================================================================
   PROJECTS CMS
   Handles loading project data and rendering content dynamically
   ========================================================================== */

(function() {
  'use strict';

  // Cache for loaded projects
  let projectsCache = null;

  // ==========================================================================
  // 1. DATA LOADING
  // ==========================================================================

  /**
   * Load projects from JSON file
   * @returns {Promise<Array>} Array of project objects
   */
  async function loadProjects() {
    if (projectsCache) {
      return projectsCache;
    }

    try {
      const response = await fetch('data/projects.json');
      if (!response.ok) {
        throw new Error('Failed to load projects');
      }
      const data = await response.json();
      projectsCache = data.projects;
      return projectsCache;
    } catch (error) {
      console.error('Error loading projects:', error);
      return [];
    }
  }

  /**
   * Get a single project by ID
   * @param {string} id - Project slug
   * @returns {Promise<Object|null>} Project object or null
   */
  async function getProject(id) {
    const projects = await loadProjects();
    return projects.find(p => p.id === id) || null;
  }

  /**
   * Get project navigation (prev/next)
   * @param {string} currentId - Current project slug
   * @returns {Promise<Object>} Object with prev and next project
   */
  async function getProjectNav(currentId) {
    const projects = await loadProjects();
    const currentIndex = projects.findIndex(p => p.id === currentId);
    
    return {
      prev: currentIndex > 0 ? projects[currentIndex - 1] : null,
      next: currentIndex < projects.length - 1 ? projects[currentIndex + 1] : null
    };
  }

  // ==========================================================================
  // 2. PROJECT GRID RENDERING (for index.html)
  // ==========================================================================

  /**
   * Render project cards in the Work section
   */
  async function renderProjectGrid() {
    const gridContainer = document.querySelector('.project-grid');
    if (!gridContainer) return;

    const projects = await loadProjects();
    
    // Update project count
    const countElement = document.querySelector('.project-count');
    if (countElement) {
      countElement.textContent = `(${String(projects.length).padStart(2, '0')})`;
    }

    // Clear existing content
    gridContainer.innerHTML = '';

    // Render each project card
    projects.forEach((project, index) => {
      const card = createProjectCard(project);
      gridContainer.appendChild(card);
      
      // Add visible class with staggered delay for animation
      setTimeout(() => {
        card.classList.add('visible');
      }, index * 100);
    });
  }

  /**
   * Create a project card element
   * @param {Object} project - Project data
   * @returns {HTMLElement} Article element
   */
  function createProjectCard(project) {
    const article = document.createElement('article');
    article.className = 'project-card reveal';
    
    // Build the URL
    const projectUrl = `case-study.html?project=${encodeURIComponent(project.id)}`;
    console.log('Creating card with URL:', projectUrl); // Debug log
    
    article.innerHTML = `
      <a href="${projectUrl}" class="project-link">
        <div class="project-image-wrapper">
          <img
            src="${project.thumbnail}"
            alt="${project.title} - ${project.category}"
            class="project-image"
            width="400"
            height="284"
            loading="lazy"
          />
        </div>
        <div class="project-info">
          <div class="project-title-row">
            <h3 class="project-title">${project.title}</h3>
            <span class="arrow-content" aria-hidden="true">
              <img src="Icons/Cards-Arrow.svg" alt="" class="project-arrow arrow-default" />
              <img src="Icons/Cards-Arrow.svg" alt="" class="project-arrow arrow-hover" />
            </span>
          </div>
          <p class="project-category">${project.category}</p>
        </div>
      </a>
    `;

    return article;
  }

  // ==========================================================================
  // 3. CASE STUDY RENDERING (for case-study.html)
  // ==========================================================================

  /**
   * Render case study page content
   */
  async function renderCaseStudy() {
    const main = document.querySelector('.case-study-main');
    if (!main) return;

    // Get project ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');

    if (!projectId) {
      showError(main, 'No project specified');
      return;
    }

    main.classList.add('loading');

    const project = await getProject(projectId);

    if (!project) {
      showError(main, 'Project not found');
      return;
    }

    // Update page title
    document.title = `${project.title} — Case Study | Aleksandar Pavlov`;

    // Populate content
    populateCaseStudy(project);

    // Setup navigation
    await setupProjectNav(projectId);

    main.classList.remove('loading');
  }

  /**
   * Populate case study elements with project data
   * @param {Object} project - Project data
   */
  function populateCaseStudy(project) {
    // Hero
    setText('#case-category', project.category);
    setText('#case-title', project.title);
    setText('#case-overview', project.overview);
    setImage('#case-hero-img', project.hero, `${project.title} hero image`);

    // Meta
    setText('#meta-client', project.client);
    setText('#meta-year', project.year);
    setText('#meta-role', project.role);
    setText('#meta-duration', project.duration);

    // Services
    const servicesContainer = document.getElementById('services-tags');
    if (servicesContainer && project.services) {
      servicesContainer.innerHTML = project.services
        .map(service => `<li>${service}</li>`)
        .join('');
    }

    // Content sections
    setText('#case-challenge', project.challenge);
    setText('#case-solution', project.solution);
    setText('#case-results', project.results);

    // Gallery
    const galleryContainer = document.getElementById('case-gallery');
    if (galleryContainer && project.gallery && project.gallery.length > 0) {
      galleryContainer.innerHTML = project.gallery
        .map(img => `
          <div class="gallery-image">
            <img src="${img}" alt="${project.title} gallery image" loading="lazy" />
          </div>
        `)
        .join('');
    }

    // Live site link
    const ctaSection = document.getElementById('case-cta-section');
    const liveLink = document.getElementById('case-live-link');
    if (ctaSection && liveLink && project.liveUrl && project.liveUrl !== '#') {
      liveLink.href = project.liveUrl;
      ctaSection.style.display = 'block';
    }
  }

  /**
   * Setup prev/next navigation
   * @param {string} currentId - Current project ID
   */
  async function setupProjectNav(currentId) {
    const nav = await getProjectNav(currentId);

    const prevLink = document.getElementById('prev-project');
    const nextLink = document.getElementById('next-project');
    const prevTitle = document.getElementById('prev-title');
    const nextTitle = document.getElementById('next-title');

    if (nav.prev && prevLink && prevTitle) {
      prevLink.href = `case-study.html?project=${nav.prev.id}`;
      prevTitle.textContent = nav.prev.title;
      prevLink.style.visibility = 'visible';
    }

    if (nav.next && nextLink && nextTitle) {
      nextLink.href = `case-study.html?project=${nav.next.id}`;
      nextTitle.textContent = nav.next.title;
      nextLink.style.visibility = 'visible';
    }
  }

  // ==========================================================================
  // 4. HELPER FUNCTIONS
  // ==========================================================================

  /**
   * Set text content of an element
   * @param {string} selector - CSS selector
   * @param {string} text - Text content
   */
  function setText(selector, text) {
    const element = document.querySelector(selector);
    if (element && text) {
      element.textContent = text;
    }
  }

  /**
   * Set image source and alt
   * @param {string} selector - CSS selector
   * @param {string} src - Image source
   * @param {string} alt - Alt text
   */
  function setImage(selector, src, alt) {
    const element = document.querySelector(selector);
    if (element && src) {
      element.src = src;
      element.alt = alt || '';
    }
  }

  /**
   * Show error state
   * @param {HTMLElement} container - Container element
   * @param {string} message - Error message
   */
  function showError(container, message) {
    container.innerHTML = `
      <div class="case-error">
        <h1>Oops!</h1>
        <p>${message}</p>
        <a href="index.html#work" class="button-primary">
          <span class="btn-content">
            <span class="btn-text">Back to Work</span>
            <span class="btn-hover-text">Back to Work</span>
          </span>
        </a>
      </div>
    `;
    container.classList.remove('loading');
  }

  // ==========================================================================
  // 5. EXPORTS
  // ==========================================================================

  // Make functions globally available
  window.loadProjects = loadProjects;
  window.renderProjectGrid = renderProjectGrid;
  window.renderCaseStudy = renderCaseStudy;

  // Auto-init based on page type
  function autoInit() {
    // Index page - render project grid
    if (document.querySelector('.project-grid')) {
      renderProjectGrid();
    }
    // Case study page - render case study
    if (document.querySelector('.case-study-main')) {
      renderCaseStudy();
    }
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

})();
