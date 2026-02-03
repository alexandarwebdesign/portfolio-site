/* ==========================================================================
   PROJECTS CMS HANDLER
   Loads project data from JSON and renders content dynamically
   ========================================================================== */

(function() {
  'use strict';

  // ==========================================================================
  // 1. DATA LOADING
  // ==========================================================================

  /**
   * Fetch projects data from JSON file
   * @returns {Promise<Array>} Array of project objects
   */
  async function loadProjects() {
    try {
      // Use absolute path from root to ensure it works on all pages
      const response = await fetch('/data/projects.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.projects || [];
    } catch (error) {
      console.error('Error loading projects:', error);
      return [];
    }
  }

  /**
   * Get featured projects sorted by year (newest first)
   * @param {Array} projects - All projects
   * @param {number} limit - Maximum number of projects to return
   * @returns {Array} Featured projects
   */
  function getFeaturedProjects(projects, limit = 6) {
    return projects
      .filter(p => p.featured)
      .sort((a, b) => b.year - a.year)
      .slice(0, limit);
  }

  /**
   * Find project by slug
   * @param {Array} projects - All projects
   * @param {string} slug - Project slug
   * @returns {Object|null} Project object or null
   */
  function findProjectBySlug(projects, slug) {
    return projects.find(p => p.slug === slug) || null;
  }

  /**
   * Get previous and next projects for navigation
   * @param {Array} projects - All projects
   * @param {string} currentSlug - Current project slug
   * @returns {Object} Object with prev and next projects
   */
  function getProjectNavigation(projects, currentSlug) {
    // Create a copy before sorting to avoid mutating the original array
    const sortedProjects = [...projects].sort((a, b) => b.year - a.year);
    const currentIndex = sortedProjects.findIndex(p => p.slug === currentSlug);
    
    return {
      prev: currentIndex > 0 ? sortedProjects[currentIndex - 1] : null,
      next: currentIndex < sortedProjects.length - 1 ? sortedProjects[currentIndex + 1] : null
    };
  }

  /**
   * Check if image is a placeholder
   * @param {string} src - Image source
   * @returns {boolean}
   */
  function isPlaceholder(src) {
    return !src || src === 'placeholder' || src === '';
  }

  /**
   * Get image attributes for rendering
   * @param {string} src - Image source
   * @param {string} alt - Alt text
   * @returns {Object} Object with src and class
   */
  function getImageAttrs(src, alt) {
    if (isPlaceholder(src)) {
      return {
        src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        className: 'placeholder'
      };
    }
    return {
      src: src,
      className: ''
    };
  }

  // ==========================================================================
  // 2. PROJECT DETAIL PAGE RENDERING
  // ==========================================================================

  /**
   * Render project detail page content
   * @param {Object} project - Project data
   * @param {Object} nav - Navigation (prev/next) projects
   */
  function renderProjectDetail(project, nav) {
    if (!project) {
      document.body.innerHTML = '<div style="padding: 100px; text-align: center;"><h1>Project Not Found</h1><p><a href="/">← Back to Home</a></p></div>';
      return;
    }

    // Update page meta
    // Dynamic SEO: Update meta tags for specific project
    const seoTitle = `${project.title} – Case Study | Aleksandar Pavlov`;
    
    // Title
    document.title = seoTitle; 
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) pageTitleEl.textContent = seoTitle;
    const pageDesc = document.getElementById('page-description');

    // Meta Description
    if (pageDesc) pageDesc.setAttribute('content', project.description);

    // Open Graph
    const ogTitle = document.getElementById('og-title');
    const ogDesc = document.getElementById('og-description');
    const ogImage = document.getElementById('og-image');
    const ogUrl = document.getElementById('og-url');

    if (ogTitle) ogTitle.setAttribute('content', seoTitle);
    if (ogDesc) ogDesc.setAttribute('content', project.description);
    if (ogImage) ogImage.setAttribute('content', project.hero_image); // Note: Assuming absolute path or handling elsewhere? User said "Real images", JSON has relative.
    // Ideally we should resolve relative paths to absolute for OG tags, but sticking to request.
    // Let's optimize by adding domain if it's relative
    if (ogImage && project.hero_image && !project.hero_image.startsWith('http')) {
         ogImage.setAttribute('content', `https://aleksandarpavlov.netlify.app/${project.hero_image}`);
    }
    if (ogUrl) ogUrl.setAttribute('content', window.location.href);

    // Twitter
    const twTitle = document.getElementById('twitter-title');
    const twDesc = document.getElementById('twitter-description');
    const twImage = document.getElementById('twitter-image');

    if (twTitle) twTitle.setAttribute('content', seoTitle);
    if (twDesc) twDesc.setAttribute('content', project.description);
    if (twImage) {
        if (project.hero_image && !project.hero_image.startsWith('http')) {
             twImage.setAttribute('content', `https://aleksandarpavlov.netlify.app/${project.hero_image}`);
        } else {
             twImage.setAttribute('content', project.hero_image);
        }
    }

    // Hero section
    document.getElementById('project-eyebrow').textContent = `${project.category} · ${project.year}`;
    document.getElementById('project-title').textContent = project.title;
    document.getElementById('project-description').textContent = project.description;
    
    const heroImage = document.getElementById('project-hero-image');
    const heroAttrs = getImageAttrs(project.hero_image, `${project.title} project hero image`);
    heroImage.src = heroAttrs.src;
    heroImage.alt = `${project.title} project hero image`;
    if (heroAttrs.className) {
      heroImage.classList.add(heroAttrs.className);
    }

    // Brief & Persona section
    document.getElementById('project-client-persona').textContent = project.client_persona || project.client;
    
    // Tags
    const tagsContainer = document.getElementById('project-tags');
    tagsContainer.innerHTML = project.tags.map(tag => 
      `<span class="project-tag">${tag}</span>`
    ).join('');

    // The Brief (formerly Challenge)
    // We expect the JSON to eventually use 'the_brief' and 'design_concept', 
    // but for now we fallback to 'challenge' and 'solution' if the new keys aren't there yet.
    document.getElementById('project-brief-text').innerHTML = project.the_brief || project.challenge;

    // The Concept (formerly Solution)
    document.getElementById('project-concept-text').innerHTML = project.design_concept || project.solution;

    // Gallery (conditional)
    const gallerySection = document.getElementById('project-gallery');
    const galleryGrid = document.getElementById('project-gallery-grid');
    if (project.gallery && project.gallery.length > 0) {
      gallerySection.style.display = 'block';
      galleryGrid.innerHTML = project.gallery.map((img, index) => {
        const attrs = getImageAttrs(img, `${project.title} gallery image ${index + 1}`);
        return `<div class="gallery-item">
          <img src="${attrs.src}" alt="${project.title} gallery image" class="${attrs.className}" loading="lazy" />
        </div>`;
      }).join('');
    }



    // Breadcrumbs
    const breadcrumbName = document.getElementById('breadcrumb-project-name');
    if (breadcrumbName) {
        breadcrumbName.textContent = project.title;
    }

    // Schema Markup Updates
    try {
        const projectSchemaScript = document.getElementById('schema-project');
        if (projectSchemaScript) {
            const schema = JSON.parse(projectSchemaScript.textContent);
            schema.name = project.title;
            schema.description = project.description;
            schema.url = window.location.href;
            if (project.date) schema.dateCreated = project.date; // if available, else standard
            projectSchemaScript.textContent = JSON.stringify(schema, null, 2);
        }

        const breadcrumbSchemaScript = document.getElementById('schema-breadcrumb');
        if (breadcrumbSchemaScript) {
            const schema = JSON.parse(breadcrumbSchemaScript.textContent);
            // Update last item (Project Name)
            if (schema.itemListElement && schema.itemListElement.length >= 3) {
                schema.itemListElement[2].name = project.title;
                schema.itemListElement[2].item = window.location.href;
            }
            breadcrumbSchemaScript.textContent = JSON.stringify(schema, null, 2);
        }
    } catch (e) {
        console.error('Error updating schema:', e);
    }

    // Project Navigation
    const prevLink = document.getElementById('prev-project');
    const nextLink = document.getElementById('next-project');
    
    if (nav.prev) {
      prevLink.href = `/project.html?slug=${nav.prev.slug}`;
      document.getElementById('prev-project-title').textContent = nav.prev.title;
      prevLink.style.visibility = 'visible';
    }
    
    if (nav.next) {
      nextLink.href = `/project.html?slug=${nav.next.slug}`;
      document.getElementById('next-project-title').textContent = nav.next.title;
      nextLink.style.visibility = 'visible';
    }
  }

  // ==========================================================================
  // 3. HOMEPAGE PROJECTS GRID RENDERING
  // ==========================================================================

  /**
   * Render featured projects on homepage
   * @param {Array} projects - Featured projects
   */
  function renderHomepageProjects(projects) {
    const grid = document.getElementById('project-grid');
    if (!grid) return;

    // Update project count
    const countEl = document.querySelector('.project-count');
    if (countEl) {
      countEl.textContent = `(${String(projects.length).padStart(2, '0')})`;
    }

    // Render project cards
    grid.innerHTML = projects.map((project, index) => {
      const thumbAttrs = getImageAttrs(project.thumbnail, `${project.title} project preview`);
      return `
      <article class="project-card reveal" style="transition-delay: ${index * 100}ms;">
        <a href="/project.html?slug=${project.slug}" class="project-card-link">
          <div class="project-image-wrapper">
            <img
              src="${thumbAttrs.src}"
              alt="${project.title} project preview"
              class="project-image ${thumbAttrs.className}"
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
      </article>
    `;}).join('');

    // Re-trigger reveal animations for dynamically loaded content
    setTimeout(() => {
      const revealElements = grid.querySelectorAll('.reveal');
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
      );
      revealElements.forEach(el => observer.observe(el));
    }, 100);
  }

  // ==========================================================================
  // 4. INITIALIZE
  // ==========================================================================

  async function init() {
    const projects = await loadProjects();
    if (projects.length === 0) {
      console.warn('No projects loaded');
      return;
    }

    // Determine current page type based on presence of specific elements
    const isProjectHero = document.getElementById('project-hero');
    const isProjectGrid = document.getElementById('project-grid');
    
    // Get slug from path (clean URL) or hash (legacy)
    // Example path: /corecloud -> corecloud
    // Example hash: /project.html#corecloud -> corecloud
    let slug = '';
    const path = window.location.pathname;
    
    if (path !== '/' && path !== '/index.html' && path !== '/project.html') {
      slug = path.substring(1); // Remove leading slash
    } else if (window.location.hash) {
      slug = window.location.hash.replace('#', '');
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      slug = urlParams.get('slug');
    }

    if (isProjectHero) {
      // Project detail page
      if (slug) {
        const project = findProjectBySlug(projects, slug);
        if (project) {
          const nav = getProjectNavigation(projects, slug);
          renderProjectDetail(project, nav);
        } else {
          // If slug found but no project, might be 404 or bad URL
          // Optional: handle 404 here
          console.error('Project not found:', slug);
          document.body.innerHTML = '<div style="padding: 100px; text-align: center;"><h1>Project Not Found</h1><p><a href="/">← Back to Home</a></p></div>';
        }
      } else {
        // Project page but no slug - show first project as fallback/default
        const firstProject = projects[0];
        const nav = getProjectNavigation(projects, firstProject.slug);
        renderProjectDetail(firstProject, nav);
      }
    } else if (isProjectGrid) {
      // Homepage - render featured projects
      const featuredProjects = getFeaturedProjects(projects, 6);
      renderHomepageProjects(featuredProjects);
    }
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
