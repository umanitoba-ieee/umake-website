/**
 * Background Change on Scroll Logic
 * Using Intersection Observer for high performance
 */
const sections = document.querySelectorAll('.bg-trigger');
const body = document.body;

const options = {
    root: null,
    threshold: 0.4, // Changes when 40% of the section is visible
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const color = entry.target.getAttribute('data-color');
            body.style.backgroundColor = color;
        }
    });
}, options);

sections.forEach(section => {
    observer.observe(section);
});




import * as THREE from 'three';

// --- TUNABLE PARAMETERS ---
const SETTINGS = {
    zoom: 24,               // Your preferred zoom level
    voxelCount: 50,         // Increase this to fill the larger grid
    gridOpacity: 0.08,      // How visible the floor grid is (0 to 1)
    moveSpeed: 0.06,        // Speed of the roll animation (higher = faster)
    maxWaitTime: 4000,      // Max milliseconds a voxel waits before moving
    shadingIntensity: 0.8,  // Contrast: 1.0 is high contrast, 0.1 is very flat
    spawnRange: 90,         // How far out voxels can spawn/travel
    colors: [0xFFC72C, 0x3b82f6, 0xffffff] // Yellow, Blue, White
};

// --- Setup ---
const canvas = document.querySelector('#voxel-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
const scene = new THREE.Scene();

// --- Isometric Camera ---
const aspect = window.innerWidth / window.innerHeight;
const d = SETTINGS.zoom;
const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
camera.position.set(40, 40, 40); // Standard isometric view
camera.lookAt(0, 0, 0);

// --- Lighting & "Shadow" Intensity ---
// We use Ambient for base light and Directional for the "shadow" contrast
const ambientLight = new THREE.AmbientLight(0xffffff, 1 - SETTINGS.shadingIntensity);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, SETTINGS.shadingIntensity);
// dirLight.position.set(10, 20, 10);
dirLight.position.set(10, 40, 30);
scene.add(dirLight);

// --- Background Grid ---
const gridHelper = new THREE.GridHelper(SETTINGS.spawnRange * 2, SETTINGS.spawnRange * 2, 0xffffff, 0xffffff);
gridHelper.material.opacity = SETTINGS.gridOpacity;
gridHelper.material.transparent = true;
// gridHelper.position.y = -0.501; // Slightly below voxels to prevent flickering
gridHelper.position.y = -1.0;
scene.add(gridHelper);

// --- Voxel Logic ---
class RollingVoxel {
    constructor() {
        this.size = 1;
        const geometry = new THREE.BoxGeometry(this.size, this.size, this.size);
        const material = new THREE.MeshPhongMaterial({ 
            color: SETTINGS.colors[Math.floor(Math.random() * SETTINGS.colors.length)],
            flatShading: true // Makes the cube faces look crisp
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        scene.add(this.mesh);

        this.isMoving = false;
        this.reset(true); // Random spawn
    }

    reset(isInitial = false) {
        // Spread them out across the large grid
        const r = SETTINGS.spawnRange;
        this.mesh.position.set(
            Math.floor((Math.random() - 0.5) * r),
            0,
            Math.floor((Math.random() - 0.5) * r)
        );
        this.mesh.rotation.set(0, 0, 0);
        this.waitTimer = Math.random() * SETTINGS.maxWaitTime;
        this.isMoving = false;
    }

    step(deltaTime) {
        if (this.isMoving) {
            this.animateRoll();
        } else {
            this.waitTimer -= deltaTime;
            if (this.waitTimer <= 0) this.startRoll();
        }
    }

    startRoll() {
        this.isMoving = true;
        this.rollProgress = 0;
        
        // Pick a random direction
        const dirs = [
            { vec: new THREE.Vector3(1, 0, 0), axis: new THREE.Vector3(0, 0, -1) }, // Right
            { vec: new THREE.Vector3(-1, 0, 0), axis: new THREE.Vector3(0, 0, 1) }, // Left
            { vec: new THREE.Vector3(0, 0, 1), axis: new THREE.Vector3(1, 0, 0) },  // Forward
            { vec: new THREE.Vector3(0, 0, -1), axis: new THREE.Vector3(-1, 0, 0) } // Backward
        ];
        const move = dirs[Math.floor(Math.random() * 4)];
        
        this.direction = move.vec;
        this.axis = move.axis;

        // Perfect Pivot Point Calculation
        // The pivot is exactly on the bottom edge in the direction of movement
        this.pivot = this.mesh.position.clone()
            .add(this.direction.clone().multiplyScalar(this.size / 2))
            .add(new THREE.Vector3(0, -this.size / 2, 0));

        this.startPosition = this.mesh.position.clone();
        this.startQuaternion = this.mesh.quaternion.clone();
    }

    animateRoll() {
        this.rollProgress += SETTINGS.moveSpeed;

        if (this.rollProgress >= 1) {
            // End Step: Perfect snapping
            this.isMoving = false;
            
            // Move position exactly 1 unit
            this.mesh.position.copy(this.startPosition).add(this.direction);
            
            // Rotate exactly 90 degrees
            const endRotation = new THREE.Quaternion().setFromAxisAngle(this.axis, Math.PI / 2);
            this.mesh.quaternion.copy(this.startQuaternion).premultiply(endRotation);

            this.waitTimer = Math.random() * SETTINGS.maxWaitTime;

            // Despawn check: If past the visual range, reset to a new random spot
            if (Math.abs(this.mesh.position.x) > SETTINGS.spawnRange || 
                Math.abs(this.mesh.position.z) > SETTINGS.spawnRange) {
                this.reset();
            }
        } else {
            // The Rolling Math
            const angle = (Math.PI / 2) * this.rollProgress;
            
            // 1. Reset to start of step
            this.mesh.position.copy(this.startPosition);
            this.mesh.quaternion.copy(this.startQuaternion);

            // 2. Pivot logic: Translate -> Rotate -> Translate back
            this.mesh.position.sub(this.pivot);
            this.mesh.position.applyAxisAngle(this.axis, angle);
            this.mesh.position.add(this.pivot);
            
            const stepRotation = new THREE.Quaternion().setFromAxisAngle(this.axis, angle);
            this.mesh.quaternion.premultiply(stepRotation);
        }
    }
}

// Instantiate Voxels
const voxels = Array.from({ length: SETTINGS.voxelCount }, () => new RollingVoxel());

// --- Animation Loop ---
let lastTime = 0;
function animate(time) {
    const deltaTime = time - lastTime;
    lastTime = time;
    voxels.forEach(v => v.step(deltaTime));
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// --- Responsive ---
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -SETTINGS.zoom * aspect;
    camera.right = SETTINGS.zoom * aspect;
    camera.top = SETTINGS.zoom;
    camera.bottom = -SETTINGS.zoom;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setSize(window.innerWidth, window.innerHeight);
requestAnimationFrame(animate);