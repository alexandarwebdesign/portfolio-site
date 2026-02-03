/* ==========================================================================
   HERO PARTICLE EFFECT
   Three.js morphing particles that form a shape on hover
   ========================================================================== */

import {
  Vector2,
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  PlaneGeometry,
  Mesh,
  Points,
  Color,
  DataTexture,
  RGBAFormat,
  FloatType,
  NearestFilter,
  WebGLRenderTarget,
  NormalBlending
} from 'https://unpkg.com/three@0.128.0/build/three.module.js';

// ==========================================================================
// 1. POISSON DISK SAMPLING
// ==========================================================================

class PoissonDiskSampling {
  constructor(options) {
    this.shape = options.shape;
    this.minDistance = options.minDistance;
    this.maxDistance = options.maxDistance || options.minDistance * 2;
    this.maxTries = options.tries || 30;
    this.rng = Math.random;
    
    this.cellSize = this.minDistance / Math.sqrt(2);
    this.gridWidth = Math.ceil(this.shape[0] / this.cellSize);
    this.gridHeight = Math.ceil(this.shape[1] / this.cellSize);
    this.grid = new Array(this.gridWidth * this.gridHeight).fill(null);
    this.points = [];
    this.activeList = [];
  }
  
  addPoint(point) {
    const gridX = Math.floor(point[0] / this.cellSize);
    const gridY = Math.floor(point[1] / this.cellSize);
    this.grid[gridY * this.gridWidth + gridX] = point;
    this.points.push(point);
    this.activeList.push(point);
    return point;
  }
  
  isValidPoint(point) {
    if (point[0] < 0 || point[0] >= this.shape[0] || 
        point[1] < 0 || point[1] >= this.shape[1]) {
      return false;
    }
    
    const gridX = Math.floor(point[0] / this.cellSize);
    const gridY = Math.floor(point[1] / this.cellSize);
    
    const searchRadius = 2;
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const nx = gridX + dx;
        const ny = gridY + dy;
        
        if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
          const neighbor = this.grid[ny * this.gridWidth + nx];
          if (neighbor) {
            const dist = Math.sqrt(
              Math.pow(point[0] - neighbor[0], 2) + 
              Math.pow(point[1] - neighbor[1], 2)
            );
            if (dist < this.minDistance) {
              return false;
            }
          }
        }
      }
    }
    return true;
  }
  
  fill() {
    const firstPoint = [
      this.rng() * this.shape[0],
      this.rng() * this.shape[1]
    ];
    this.addPoint(firstPoint);
    
    while (this.activeList.length > 0) {
      const randomIndex = Math.floor(this.rng() * this.activeList.length);
      const point = this.activeList[randomIndex];
      
      let found = false;
      for (let i = 0; i < this.maxTries; i++) {
        const angle = this.rng() * Math.PI * 2;
        const distance = this.minDistance + this.rng() * (this.maxDistance - this.minDistance);
        
        const newPoint = [
          point[0] + Math.cos(angle) * distance,
          point[1] + Math.sin(angle) * distance
        ];
        
        if (this.isValidPoint(newPoint)) {
          this.addPoint(newPoint);
          found = true;
          break;
        }
      }
      
      if (!found) {
        this.activeList.splice(randomIndex, 1);
      }
    }
    
    return this.points;
  }
}

// ==========================================================================
// 2. MORPHING PARTICLES CLASS
// ==========================================================================

class MorphingParticles {
  constructor(container, imageUrl) {
    this.container = container;
    this.imageUrl = imageUrl;
    this.width = container.offsetWidth || window.innerWidth;
    this.height = container.offsetHeight || window.innerHeight;
    this.size = 256;
    this.particleCount = 0;
    this.isHovering = false;
    this.hoverProgress = 0;
    this.mousePos = new Vector2(0, 0);
    this.time = 0;
    
    this.colors = {
      color1: 0x0066FF, // Blue (accent color)
      color2: 0x9AA0A6, // Gray
      color3: 0x9AA0A6  // Gray
    };
    
    this.init();
  }
  
  async init() {
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.z = 1;
    
    this.renderer = new WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);
    
    await this.loadImage();
    this.createBasePoints();
    this.createImagePoints();
    this.createSimulation();
    this.createParticles();
    this.setupEvents();
    this.animate();
    
    // Auto-activate animation after 2000ms on mobile/tablet
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        this.isHovering = true;
      }, 2000);
    }
  }
  
  loadImage() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 500, 500);
        this.imageData = ctx.getImageData(0, 0, 500, 500);
        resolve();
      };
      img.onerror = reject;
      img.src = this.imageUrl;
    });
  }
  
  createBasePoints() {
    const sampler = new PoissonDiskSampling({
      shape: [500, 500],
      minDistance: 8,
      maxDistance: 10,
      tries: 20
    });
    
    this.basePoints = sampler.fill();
    this.particleCount = this.basePoints.length;
  }
  
  getPixelBrightness(x, y) {
    const px = Math.round(Math.max(0, Math.min(499, x)));
    const py = Math.round(Math.max(0, Math.min(499, y)));
    const index = (py * 500 + px) * 4;
    const r = this.imageData.data[index];
    return 1 - (r / 255);
  }
  
  createImagePoints() {
    this.targetPoints = [];
    const imagePoints = [];
    const gap = 4;
    
    for (let y = 0; y < 500; y += gap) {
      for (let x = 0; x < 500; x += gap) {
        const brightness = this.getPixelBrightness(x, y);
        if (brightness > 0.5) {
          imagePoints.push([x, y]);
        }
      }
    }
    
    for (let i = 0; i < this.basePoints.length; i++) {
      const basePoint = this.basePoints[i];
      let nearestPoint = basePoint;
      let nearestDistance = Infinity;
      
      for (let j = 0; j < imagePoints.length; j++) {
        const imgPoint = imagePoints[j];
        const distance = Math.sqrt(
          Math.pow(imgPoint[0] - basePoint[0], 2) +
          Math.pow(imgPoint[1] - basePoint[1], 2)
        );
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPoint = imgPoint;
        }
      }
      
      this.targetPoints.push(nearestPoint);
    }
  }
  
  createDataTexture(points, isTarget = false) {
    const data = new Float32Array(this.size * this.size * 4);
    
    for (let i = 0; i < this.particleCount; i++) {
      const point = isTarget ? this.targetPoints[i] : this.basePoints[i];
      const idx = i * 4;
      
      data[idx + 0] = (point[0] - 250) / 250;
      data[idx + 1] = (point[1] - 250) / 250;
      data[idx + 2] = Math.random();
      data[idx + 3] = 0;
    }
    
    const texture = new DataTexture(
      data,
      this.size,
      this.size,
      RGBAFormat,
      FloatType
    );
    texture.needsUpdate = true;
    return texture;
  }
  
  createSimulation() {
    this.positionTexture = this.createDataTexture(this.basePoints, false);
    this.targetTexture = this.createDataTexture(this.targetPoints, true);
    this.baseTexture = this.createDataTexture(this.basePoints, false);
    
    const rtOptions = {
      format: RGBAFormat,
      type: FloatType,
      minFilter: NearestFilter,
      magFilter: NearestFilter
    };
    
    this.rt1 = new WebGLRenderTarget(this.size, this.size, rtOptions);
    this.rt2 = new WebGLRenderTarget(this.size, this.size, rtOptions);
    
    this.simScene = new Scene();
    this.simCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    this.simMaterial = new ShaderMaterial({
      uniforms: {
        uPosition: { value: this.positionTexture },
        uPosRefs: { value: this.baseTexture },
        uPosNearest: { value: this.targetTexture },
        uTime: { value: 0 },
        uDeltaTime: { value: 0 },
        uIsHovering: { value: 0 }
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        
        uniform sampler2D uPosition;
        uniform sampler2D uPosRefs;
        uniform sampler2D uPosNearest;
        uniform float uTime;
        uniform float uDeltaTime;
        uniform float uIsHovering;
        
        vec2 hash(vec2 p) {
          p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
          return fract(sin(p) * 43758.5453);
        }
        
        void main() {
          vec2 uv = gl_FragCoord.xy / ${this.size.toFixed(1)};
          vec4 pos = texture2D(uPosition, uv);
          
          float scale = pos.z;
          float velocity = pos.w;
          
          vec2 refPos = texture2D(uPosRefs, uv).xy;
          vec2 nearestPos = texture2D(uPosNearest, uv).xy;
          
          float seed = hash(uv).x;
          float seed2 = hash(uv).y;
          
          float time = uTime * 0.5;
          float lifeEnd = 3.0 + sin(seed2 * 100.0) * 1.0;
          float lifeTime = mod((seed * 100.0) + time, lifeEnd);
          
          vec2 targetPos = mix(refPos, nearestPos, uIsHovering * uIsHovering);
          
          vec2 direction = normalize(targetPos - pos.xy);
          float dist = length(targetPos - pos.xy);
          float distStrength = smoothstep(0.15, 0.0, dist);
          
          if (dist > 0.005) {
            pos.xy += direction * 0.01 * distStrength;
          }
          
          if (lifeTime < 0.01) {
            pos.xy = refPos;
            scale = 0.0;
          }
          
          float targetScale = smoothstep(0.01, 0.5, lifeTime) - smoothstep(0.5, 1.0, lifeTime / lifeEnd);
          targetScale += smoothstep(0.1, 0.0, dist) * 0.0 * uIsHovering;
          
          scale += (targetScale - scale) * 0.1;
          velocity = smoothstep(0.15, 0.001, dist) * uIsHovering;
          
          gl_FragColor = vec4(pos.xy, scale, velocity);
        }
      `
    });
    
    const simGeometry = new PlaneGeometry(2, 2);
    this.simMesh = new Mesh(simGeometry, this.simMaterial);
    this.simScene.add(this.simMesh);
  }
  
  createParticles() {
    const geometry = new BufferGeometry();
    
    const positions = new Float32Array(this.particleCount * 3);
    const uvs = new Float32Array(this.particleCount * 2);
    const seeds = new Float32Array(this.particleCount * 4);
    
    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      
      const u = (i % this.size) / this.size;
      const v = Math.floor(i / this.size) / this.size;
      uvs[i * 2 + 0] = u;
      uvs[i * 2 + 1] = v;
      
      seeds[i * 4 + 0] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = Math.random();
    }
    
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    geometry.setAttribute('seeds', new BufferAttribute(seeds, 4));
    
    this.renderMaterial = new ShaderMaterial({
      uniforms: {
        uPosition: { value: this.positionTexture },
        uTime: { value: 0 },
        uParticleScale: { value: 1.0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uIsHovering: { value: 0 },
        uColor1: { value: new Color(this.colors.color1) },
        uColor2: { value: new Color(this.colors.color2) },
        uColor3: { value: new Color(this.colors.color3) }
      },
      vertexShader: `
        precision highp float;
        
        attribute vec4 seeds;
        
        uniform sampler2D uPosition;
        uniform float uTime;
        uniform float uParticleScale;
        uniform float uPixelRatio;
        uniform float uIsHovering;
        
        varying vec4 vSeeds;
        varying float vScale;
        varying float vVelocity;
        varying vec2 vPos;
        
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        
        void main() {
          vec4 posData = texture2D(uPosition, uv);
          vec2 pos = posData.xy;
          
          vSeeds = seeds;
          vScale = posData.z;
          vVelocity = posData.w;
          vPos = pos;
          
          float noiseX = snoise(vec3(pos * 10.0, uTime * 0.2 + 100.0));
          float noiseY = snoise(vec3(pos * 10.0, uTime * 0.2));
          float noiseX2 = snoise(vec3(pos * 0.5, uTime * 0.15 + 45.0));
          float noiseY2 = snoise(vec3(pos * 0.5, uTime * 0.15 + 87.0));
          
          float dist = smoothstep(0.0, 0.9, vVelocity);
          dist = mix(0.0, dist, uIsHovering);
          
          pos.y += noiseY * 0.005 * dist;
          pos.x += noiseX * 0.005 * dist;
          pos.y += noiseY2 * 0.02;
          pos.x += noiseX2 * 0.02;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 0.0, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          float baseSize = 0.5;
          gl_PointSize = (((vScale * 12.6) * (uPixelRatio * 0.5) * uParticleScale) + (0.9 * uPixelRatio)) * baseSize;
        }
      `,
      fragmentShader: `
        precision highp float;
        
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform float uIsHovering;
        
        varying vec4 vSeeds;
        varying float vScale;
        varying float vVelocity;
        varying vec2 vPos;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          if (dist > 0.5) discard;
          
          float alpha = smoothstep(0.5, 0.4, dist);
          alpha *= vScale;
          
          vec3 grayColor = uColor2;
          vec3 blueColor = uColor1;
          
          // Color: only shape-forming particles turn blue
          vec3 color = mix(grayColor, blueColor, vVelocity);
          
          // For non-shape particles (low vVelocity), keep consistent appearance
          // For shape-forming particles (high vVelocity), maintain full visibility
          float isShapeParticle = smoothstep(0.1, 0.5, vVelocity);
          
          // Base alpha for non-shape particles stays consistent (same in active/inactive)
          // Shape particles get full alpha when active
          float baseAlpha = 0.3;
          float shapeAlpha = 1.0;
          float finalAlpha = mix(baseAlpha, shapeAlpha, isShapeParticle * uIsHovering);
          
          // In inactive state, all particles use baseAlpha
          // In active state, only shape particles get enhanced
          float inactiveBaseAlpha = mix(baseAlpha, finalAlpha, uIsHovering);
          float combinedAlpha = mix(baseAlpha, inactiveBaseAlpha, step(0.01, uIsHovering) + (1.0 - step(0.01, uIsHovering)));
          
          // Simplified: non-shape particles always at baseAlpha, shape particles enhanced when active
          float particleAlpha = mix(baseAlpha, mix(baseAlpha, shapeAlpha, isShapeParticle), uIsHovering);
          
          gl_FragColor = vec4(color, alpha * 0.9 * particleAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending
    });
    
    this.particles = new Points(geometry, this.renderMaterial);
    this.scene.add(this.particles);
  }
  
  setupEvents() {
    const isMobileOrTablet = () => window.innerWidth <= 768;
    
    window.addEventListener('mousemove', (e) => {
      this.mousePos.x = (e.clientX / this.width) * 2 - 1;
      this.mousePos.y = -(e.clientY / this.height) * 2 + 1;
    });
    
    // Desktop: hover behavior
    this.container.addEventListener('mouseenter', () => {
      if (!isMobileOrTablet()) {
        this.isHovering = true;
      }
    });
    
    this.container.addEventListener('mouseleave', () => {
      if (!isMobileOrTablet()) {
        this.isHovering = false;
      }
    });
    
    // Mobile/Tablet: click to toggle
    this.container.addEventListener('click', () => {
      if (isMobileOrTablet()) {
        this.isHovering = !this.isHovering;
      }
    });
    
    // Also handle touch events
    this.container.addEventListener('touchend', (e) => {
      if (isMobileOrTablet()) {
        e.preventDefault();
        this.isHovering = !this.isHovering;
      }
    });
    
    window.addEventListener('resize', () => {
      this.width = this.container.offsetWidth || window.innerWidth;
      this.height = this.container.offsetHeight || window.innerHeight;
      this.renderer.setSize(this.width, this.height);
    });
  }
  
  update() {
    this.time += 0.016;
    
    const targetHover = this.isHovering ? 1 : 0;
    this.hoverProgress += (targetHover - this.hoverProgress) * 0.05;
    
    this.simMaterial.uniforms.uPosition.value = this.rt1.texture;
    this.simMaterial.uniforms.uTime.value = this.time;
    this.simMaterial.uniforms.uDeltaTime.value = 0.016;
    this.simMaterial.uniforms.uIsHovering.value = this.hoverProgress;
    
    this.renderer.setRenderTarget(this.rt2);
    this.renderer.render(this.simScene, this.simCamera);
    this.renderer.setRenderTarget(null);
    
    this.renderMaterial.uniforms.uPosition.value = this.rt2.texture;
    this.renderMaterial.uniforms.uTime.value = this.time;
    this.renderMaterial.uniforms.uIsHovering.value = this.hoverProgress;
    this.renderMaterial.uniforms.uParticleScale.value = this.width / 1000;
    
    [this.rt1, this.rt2] = [this.rt2, this.rt1];
  }
  
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    this.update();
    this.render();
  }
}

// ==========================================================================
// 3. INITIALIZE
// ==========================================================================

function initHeroParticles() {
  const container = document.getElementById('hero-particles');
  if (!container) return;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    new MorphingParticles(container, img.src);
  };
  
  // Load shape image
  img.src = 'images/shape.png';
  
  // Fallback if image doesn't load
  img.onerror = () => {
    console.log('Shape image not found, using fallback');
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 500, 500);
    
    ctx.fillStyle = 'black';
    ctx.font = 'bold 300px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('< >', 250, 250);
    
    new MorphingParticles(container, canvas.toDataURL());
  };
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroParticles);
} else {
  initHeroParticles();
}
