// ============================================================================
// Emoji Detection Music Player
// ============================================================================

// Configuration
const CONFIG = {
    CONFIDENCE_THRESHOLD: 0.75,
    SMOOTHING_FRAMES: 8, // Number of consecutive frames required for stable detection
    TARGETS_FILE: './targets.mind', // MindAR targets file
    MOCK_MODE: false, // Set to true for testing without camera
};

// Target Labels - Mapping target indices to display names
// MindAR targets.mind file contains 6 image targets (indices 0-5)
const TARGET_LABELS = {
    0: "Chill",
    1: "Confused",
    2: "Dreamy",
    3: "Energy",
    4: "Happy",
    5: "Sad"
};

// Playlist mapping: emoji combinations -> tracks
// Normalize combos by sorting emojis alphabetically
const COMBO_PLAYLISTS = {
    // Example: Happy + Devil combo (order-independent)
    '😄|😈': [
        { title: 'Track A', artist: 'Artist A', src: './assets/audio/track-a.mp3' },
        { title: 'Track B', artist: 'Artist B', src: './assets/audio/track-b.mp3' },
    ],
    '😈|😄': [], // Will use same as 😄|😈 (normalized)
    
    // Single emoji playlists
    '😄|—': [
        { title: 'Happy Track 1', artist: 'Happy Artist', src: './assets/audio/happy-1.mp3' },
    ],
    '😈|—': [
        { title: 'Devil Track 1', artist: 'Devil Artist', src: './assets/audio/devil-1.mp3' },
    ],
    
    // Default fallback playlist
    'DEFAULT': [
        { title: 'Default Track', artist: 'Default Artist', src: './assets/audio/default.mp3' },
    ],
};

// ============================================================================
// MindAR Image Tracking Adapter
// ============================================================================

class EmojiModelAdapter {
    constructor() {
        this.scene = null;
        this.mindarSystem = null;
        this.isLoaded = false;
        this.targetsCreated = false; // Track if targets have been created to prevent duplicates
    }

    /**
     * Load MindAR scene and start tracking
     */
    async loadModel() {
        try {
            if (CONFIG.MOCK_MODE) {
                console.log('Model loading skipped (MOCK_MODE enabled)');
                this.isLoaded = false;
                return true;
            }

            console.log('Step 1: Checking A-Frame...');
            // Wait for A-Frame to be ready
            if (typeof AFRAME === 'undefined') {
                console.error('A-Frame is not defined! Check script loading order.');
                throw new Error('A-Frame not loaded. Make sure script tag is present.');
            }
            console.log('✓ A-Frame is available');

            console.log('Step 2: Waiting for document ready...');
            await new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                }
            });
            console.log('✓ Document is ready');

            console.log('Step 3: Finding AR scene element...');
            const sceneEl = document.getElementById('arScene');
            if (!sceneEl) {
                console.error('AR scene element not found in DOM!');
                console.error('Available elements with id:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
                throw new Error('AR scene element not found');
            }
            console.log('✓ AR scene element found');
            console.log('Scene parent:', sceneEl.parentElement);
            console.log('Scene visibility:', window.getComputedStyle(sceneEl.parentElement).display);

            this.scene = sceneEl;
            
            // Ensure scene is attached and visible
            if (!this.scene.parentElement || this.scene.parentElement.classList.contains('hidden')) {
                console.warn('Scene parent is hidden, this may cause initialization issues');
            }
            
            console.log('Step 4: Waiting for scene to load...');
            // Wait for scene to be ready
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Scene loaded timeout after 5 seconds'));
                }, 5000);
                
                if (this.scene.hasLoaded) {
                    console.log('Scene already loaded');
                    clearTimeout(timeout);
                    resolve();
                } else {
                    console.log('Waiting for scene loaded event...');
                    this.scene.addEventListener('loaded', () => {
                        console.log('Scene loaded event fired');
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                }
            });
            console.log('✓ Scene is loaded');

            console.log('Step 5: Getting MindAR system...');
            
            // Check if mindar-image component is registered
            const mindarComponents = Object.keys(AFRAME.components).filter(k => k.includes('mindar'));
            console.log('Available MindAR components:', mindarComponents);
            
            if (!mindarComponents.includes('mindar-image')) {
                console.warn('mindar-image component not found yet, but continuing...');
                // Don't throw error - let it initialize naturally
            } else {
                console.log('✓ MindAR component is registered');
            }
            
            // Get the system - wait for it to be available
            // MindAR system becomes available after the scene fully initializes
            let attempts = 0;
            while (!this.mindarSystem && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Try to get the system from the scene - system name is 'mindar-image-system'
                this.mindarSystem = this.scene.systems['mindar-image-system'] || this.scene.systems['mindar-image'];
                
                attempts++;
                if (!this.mindarSystem && attempts % 10 === 0) {
                    console.log(`Waiting for MindAR system... attempt ${attempts}/50`);
                    console.log('Current systems:', Object.keys(this.scene.systems));
                }
            }
            
            if (this.mindarSystem) {
                console.log('✓ MindAR system found');
            } else {
                console.warn('MindAR system not found after waiting, but camera should still work');
                console.log('Available systems:', Object.keys(this.scene.systems));
                // Don't throw error - camera will still work, just no AR tracking
                // Return true to continue
                return true;
            }

            if (this.mindarSystem) {
                console.log('Step 6: Setting up event listeners...');
                // Set up event listeners for target detection
                // Targets will be created inside arReady event handler
                this.setupMindAREvents();
                console.log('✓ Event listeners set up');

                console.log('Step 7: Starting MindAR tracking...');
                // Try to start MindAR explicitly
                try {
                    if (typeof this.mindarSystem.start === 'function') {
                        console.log('Calling mindarSystem.start()...');
                        await this.mindarSystem.start();
                        console.log('✓ MindAR started');
                    } else {
                        console.log('start() method not available, waiting for auto-start...');
                        // Wait a bit for auto-initialization
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (startError) {
                    console.warn('Error starting MindAR (may auto-start anyway):', startError.message);
                }
            } else {
                console.log('Skipping MindAR setup - system not available, but scene should still show camera');
            }

            this.isLoaded = true;
            console.log('✓ MindAR loaded and started successfully');
            
            return true;
        } catch (error) {
            console.error('❌ Error loading MindAR:', error);
            console.error('Error stack:', error.stack);
            this.isLoaded = false;
            return false;
        }
    }

    /**
     * Set up MindAR event listeners for target tracking
     * Targets are created only once, inside the arReady event handler
     */
    setupMindAREvents() {
        console.log('Setting up MindAR event listeners...');
        
        // Listen for arReady event (fires when camera is ready)
        // This is the ONLY place where targets should be created
        this.scene.addEventListener('arReady', () => {
            console.log('✓ MindAR arReady event fired - camera should be active');
            
            // Create target entities only once, inside arReady event
            if (!this.targetsCreated) {
                this.createTargetEntities();
                this.targetsCreated = true;
            }
        }, { once: true });
        
        // Listen for arError event
        this.scene.addEventListener('arError', (event) => {
            console.error('❌ MindAR error:', event.detail);
        });
    }
    
    /**
     * Create exactly 6 mindar-image-target entities (indices 0-5)
     * Each target gets a floating text label that appears above it when detected
     * This function is called only once, inside the arReady event handler
     */
    createTargetEntities() {
        console.log('Creating 6 target entities (indices 0-5) for MindAR tracking');
        
        // Verify no targets exist yet (safety check)
        const existingTargets = this.scene.querySelectorAll('a-mindar-image-target');
        if (existingTargets.length > 0) {
            console.warn('Target entities already exist! Removing duplicates.');
            existingTargets.forEach(el => el.remove());
        }
        
        // Create exactly 6 target entities (one for each target in targets.mind)
        for (let targetIndex = 0; targetIndex < 6; targetIndex++) {
            const labelText = TARGET_LABELS[targetIndex] || `Target ${targetIndex}`;
            
            // Create the mindar-image-target entity
            const targetEl = document.createElement('a-mindar-image-target');
            targetEl.setAttribute('targetIndex', targetIndex);
            targetEl.id = `target-${targetIndex}`;
            
            // Create a floating text label entity as a child of the target
            // The text will be positioned slightly above the target (0 0.6 0 relative position)
            const textEl = document.createElement('a-text');
            textEl.setAttribute('value', labelText);
            textEl.setAttribute('align', 'center'); // Center the text
            textEl.setAttribute('color', '#FFFFFF'); // White text
            textEl.setAttribute('position', '0 0.6 0'); // Position above target
            textEl.setAttribute('scale', '2 2 2'); // Make text readable
            textEl.setAttribute('look-at', '[camera]'); // Text always faces camera
            textEl.id = `label-${targetIndex}`;
            textEl.setAttribute('visible', false); // Hidden by default, shown when target found
            
            // Add text as child of target entity
            targetEl.appendChild(textEl);
            
            // Handle targetFound event: show the text label
            targetEl.addEventListener('targetFound', () => {
                console.log(`🎯 Target ${targetIndex} (${labelText}) FOUND!`);
                textEl.setAttribute('visible', true);
            });
            
            // Handle targetLost event: hide the text label
            targetEl.addEventListener('targetLost', () => {
                console.log(`❌ Target ${targetIndex} (${labelText}) LOST`);
                textEl.setAttribute('visible', false);
            });
            
            // Add target entity to scene
            this.scene.appendChild(targetEl);
            console.log(`✓ Created target entity ${targetIndex} (${labelText}) with floating label`);
        }
        
        // Verify all 6 targets were created
        const allTargets = this.scene.querySelectorAll('a-mindar-image-target');
        console.log(`✓ All ${allTargets.length} target entities created and added to scene`);
    }

    /**
     * Get current detections from MindAR
     * This method is kept for compatibility but labels are now handled by A-Frame text entities
     * @returns {Array} Empty array - labels are displayed via A-Frame entities, not this method
     */
    getDetections() {
        // Labels are now displayed directly via A-Frame text entities attached to targets
        // No need to return detections here - the text labels show/hide automatically
        return [];
    }

}

// ============================================================================
// Detection State Manager
// ============================================================================

class DetectionState {
    constructor() {
        this.emojiA = null;
        this.emojiB = null;
        this.smoothingBuffer = {
            emojiA: [],
            emojiB: []
        };
        this.frameCount = 0;
    }

    /**
     * Update detection state with smoothing
     * @param {Array<{label: string, confidence: number}>} predictions - Top predictions
     */
    update(predictions) {
        this.frameCount++;
        
        // Get top two predictions
        const topTwo = predictions.slice(0, 2);
        const predA = topTwo[0] || null;
        const predB = topTwo[1] || null;

        // Add to smoothing buffer
        this.smoothingBuffer.emojiA.push(predA?.label || null);
        this.smoothingBuffer.emojiB.push(predB?.label || null);

        // Keep only last N frames
        if (this.smoothingBuffer.emojiA.length > CONFIG.SMOOTHING_FRAMES) {
            this.smoothingBuffer.emojiA.shift();
            this.smoothingBuffer.emojiB.shift();
        }

        // Check if we have enough frames for stable detection
        if (this.smoothingBuffer.emojiA.length >= CONFIG.SMOOTHING_FRAMES) {
            // Get most common value in buffer
            const stableA = this.getStableValue(this.smoothingBuffer.emojiA);
            const stableB = this.getStableValue(this.smoothingBuffer.emojiB);

            // Update state only if changed
            if (stableA !== this.emojiA || stableB !== this.emojiB) {
                this.emojiA = stableA;
                this.emojiB = stableB;
                return true; // State changed
            }
        }

        return false; // State unchanged
    }

    /**
     * Get most common value in array (for smoothing)
     */
    getStableValue(arr) {
        const counts = {};
        let maxCount = 0;
        let maxValue = null;

        arr.forEach(val => {
            if (val === null) return;
            counts[val] = (counts[val] || 0) + 1;
            if (counts[val] > maxCount) {
                maxCount = counts[val];
                maxValue = val;
            }
        });

        // Require at least 60% of frames to agree
        return maxCount >= CONFIG.SMOOTHING_FRAMES * 0.6 ? maxValue : null;
    }

    /**
     * Get normalized combo key (order-independent)
     */
    getComboKey() {
        const emojis = [this.emojiA, this.emojiB].filter(e => e !== null);
        if (emojis.length === 0) return 'DEFAULT';
        if (emojis.length === 1) return `${emojis[0]}|—`;
        
        // Sort alphabetically for order independence
        const sorted = emojis.sort();
        return sorted.join('|');
    }

    /**
     * Reset state
     */
    reset() {
        this.emojiA = null;
        this.emojiB = null;
        this.smoothingBuffer = { emojiA: [], emojiB: [] };
        this.frameCount = 0;
    }
}

// ============================================================================
// Music Player Class
// ============================================================================

class MusicPlayer {
    constructor() {
        this.audio = new Audio();
        this.currentPlaylist = [];
        this.currentTrackIndex = -1;
        this.currentCombo = null;
        this.isPlaying = false;
        this.volume = 1.0;

        this.setupAudioListeners();
    }

    setupAudioListeners() {
        this.audio.addEventListener('loadedmetadata', () => {
            this.updateProgress();
        });

        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
        });

        this.audio.addEventListener('ended', () => {
            this.next();
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.updateTrackInfo('Error loading track', '');
        });
    }

    /**
     * Switch to a new playlist based on emoji combo
     */
    switchPlaylist(comboKey) {
        if (comboKey === this.currentCombo) {
            return; // Already playing this combo
        }

        // Get playlist for combo (normalize order)
        let playlist = COMBO_PLAYLISTS[comboKey];
        
        // Try reverse order if not found
        if (!playlist && comboKey.includes('|')) {
            const parts = comboKey.split('|');
            if (parts.length === 2) {
                const reversed = `${parts[1]}|${parts[0]}`;
                playlist = COMBO_PLAYLISTS[reversed];
            }
        }

        // Fallback to default
        if (!playlist || playlist.length === 0) {
            playlist = COMBO_PLAYLISTS['DEFAULT'] || [];
        }

        this.currentPlaylist = playlist;
        this.currentCombo = comboKey;
        this.currentTrackIndex = -1;

        // If playing, switch to new playlist
        if (this.isPlaying) {
            this.pause();
            this.next();
        } else {
            // Preload first track
            this.next();
        }
    }

    /**
     * Play current track
     */
    async play() {
        if (this.currentTrackIndex < 0 || this.currentPlaylist.length === 0) {
            return;
        }

        const track = this.currentPlaylist[this.currentTrackIndex];
        if (this.audio.src !== track.src) {
            this.audio.src = track.src;
        }

        try {
            await this.audio.play();
            this.isPlaying = true;
            this.updatePlayButton();
        } catch (error) {
            console.error('Play error:', error);
        }
    }

    /**
     * Pause current track
     */
    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayButton();
    }

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Next track
     */
    next() {
        if (this.currentPlaylist.length === 0) return;

        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.currentPlaylist.length;
        const track = this.currentPlaylist[this.currentTrackIndex];
        
        this.audio.src = track.src;
        this.updateTrackInfo(track.title, track.artist);
        
        if (this.isPlaying) {
            this.play();
        }
    }

    /**
     * Previous track
     */
    prev() {
        if (this.currentPlaylist.length === 0) return;

        this.currentTrackIndex = this.currentTrackIndex <= 0 
            ? this.currentPlaylist.length - 1 
            : this.currentTrackIndex - 1;
        
        const track = this.currentPlaylist[this.currentTrackIndex];
        this.audio.src = track.src;
        this.updateTrackInfo(track.title, track.artist);
        
        if (this.isPlaying) {
            this.play();
        }
    }

    /**
     * Set volume (0-1)
     */
    setVolume(volume) {
        this.volume = volume;
        this.audio.volume = volume;
    }

    /**
     * Update UI elements
     */
    updateTrackInfo(title, artist) {
        // UI removed - track info no longer displayed
    }

    updatePlayButton() {
        // UI removed - play button no longer displayed
    }

    updateProgress() {
        // UI removed - progress bar no longer displayed
    }

    formatTime(seconds) {
        if (!isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// ============================================================================
// Main App Controller
// ============================================================================

class AppController {
    constructor() {
        this.modelAdapter = new EmojiModelAdapter();
        this.detectionState = new DetectionState();
        this.musicPlayer = new MusicPlayer();
        
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.scene = null;
        
        if (!this.overlayCanvas) {
            console.error('Overlay canvas not found!');
            return;
        }
        
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.isDetecting = false;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Start button
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', () => {
                this.startApp();
            });
        }
    }

    async startApp() {
        console.log('startApp called, MOCK_MODE:', CONFIG.MOCK_MODE);
        
        // Step 1: Show app container FIRST (scene must be visible for camera)
        const startOverlay = document.getElementById('startOverlay');
        const app = document.getElementById('app');
        if (startOverlay) startOverlay.classList.add('hidden');
        if (app) {
            app.classList.remove('hidden');
            console.log('App container is now visible');
            // Force reflow to ensure visibility
            void app.offsetHeight;
        }

        // Set overlay canvas size
        this.overlayCanvas.width = window.innerWidth;
        this.overlayCanvas.height = window.innerHeight;

        // Wait a moment for DOM to update and scene to become visible
        await new Promise(resolve => setTimeout(resolve, 200));

        if (!CONFIG.MOCK_MODE) {
            // Step 2: Now initialize MindAR (scene is visible, so camera can be requested)
            console.log('Loading MindAR tracking (scene is visible)...');
            const loaded = await this.modelAdapter.loadModel();
            if (loaded) {
                console.log('MindAR model loaded successfully');
            } else {
                console.error('Failed to load MindAR model');
                // Don't block - continue anyway
                console.log('Continuing without AR tracking');
            }
        }

        // Start detection loop
        this.startDetection();
    }


    startDetection() {
        this.isDetecting = true;
        this.detectionLoop();
    }

    async detectionLoop() {
        if (!this.isDetecting) return;

        if (!CONFIG.MOCK_MODE) {
            // Check if model is loaded
            if (!this.modelAdapter.isLoaded) {
                requestAnimationFrame(() => this.detectionLoop());
                return;
            }

            // Labels are now displayed via A-Frame text entities, not through detection loop
            // Just draw the status message
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            this.drawDetectionStatus(0);
        }

        requestAnimationFrame(() => this.detectionLoop());
    }

    /**
     * Draw detection status indicator
     * @param {number} detectionCount - Number of currently detected targets
     */
    drawDetectionStatus(detectionCount) {
        if (!this.overlayCanvas) {
            console.warn('Cannot draw status: missing overlayCanvas element');
            return;
        }
        
        if (!this.overlayCtx) {
            console.warn('Cannot draw status: missing overlayCtx, reinitializing...');
            this.overlayCtx = this.overlayCanvas.getContext('2d');
            if (!this.overlayCtx) {
                console.error('Failed to get canvas context');
                return;
            }
        }

        // Ensure canvas is sized correctly
        if (this.overlayCanvas.width !== window.innerWidth || this.overlayCanvas.height !== window.innerHeight) {
            this.overlayCanvas.width = window.innerWidth;
            this.overlayCanvas.height = window.innerHeight;
        }

        // Always show "Move camera towards Mood Cubes" message
        const statusText = 'Move camera towards Mood Cubes';
        
        // Set font - use system font as fallback if Deezer font doesn't load
        this.overlayCtx.font = 'bold 28px "Deezer Product", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        this.overlayCtx.textAlign = 'center';
        this.overlayCtx.textBaseline = 'middle';
        
        const margin = 40;
        
        // Center horizontally, position at bottom
        const x = this.overlayCanvas.width / 2;
        const y = this.overlayCanvas.height - margin;
        
        // Draw status text in purple (#A238FF) with shadow for visibility
        this.overlayCtx.fillStyle = '#A238FF';
        // Add white shadow/outline for better visibility against camera background
        this.overlayCtx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        this.overlayCtx.shadowBlur = 8;
        this.overlayCtx.shadowOffsetX = 0;
        this.overlayCtx.shadowOffsetY = 0;
        this.overlayCtx.fillText(statusText, x, y);
        
        // Reset shadow
        this.overlayCtx.shadowColor = 'transparent';
        this.overlayCtx.shadowBlur = 0;
    }

    /**
     * Draw labels for MindAR detected targets
     * @param {Array<{label: string, confidence: number, targetIndex: number}>} detections
     * @param {number} detectionCount - Number of detections (for status)
     */
    drawMindARDetections(detections, detectionCount = 0) {
        if (!this.overlayCanvas || !this.overlayCtx) {
            console.warn('Cannot draw detections: missing overlay canvas');
            return;
        }

        // Always clear canvas first
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        if (!detections || detections.length === 0) {
            // Draw status only if no detections
            this.drawDetectionStatus(0);
            return;
        }
        
        console.log('Drawing detections:', detections.map(d => `${d.label} (${d.targetIndex})`));

        // Draw labels for each detection
        // Position labels at top of screen, staggered for multiple detections
        detections.forEach((detection, index) => {
            const labelText = `${detection.label}`;
            const confidenceText = `${Math.round(detection.confidence * 100)}%`;
            const fullText = `${labelText} ${confidenceText}`;
            
            // Use larger, bolder font for better visibility with Deezer font
            this.overlayCtx.font = 'bold 48px "Deezer Product", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            const textMetrics = this.overlayCtx.measureText(fullText);
            const textWidth = textMetrics.width;
            const textHeight = 50;
            const padding = 20;
            const borderRadius = 12;
            
            // Position labels at top center, staggered
            const x = (this.overlayCanvas.width - textWidth) / 2;
            const y = 100 + (index * (textHeight + padding + 30));
            
            // Draw label background rectangle
            const rectX = x - padding;
            const rectY = y - textHeight - padding;
            const rectWidth = textWidth + (padding * 2);
            const rectHeight = textHeight + (padding * 2);
            
            // Use modern roundRect if available, otherwise use regular rectangle
            this.overlayCtx.fillStyle = 'rgba(162, 56, 255, 0.9)'; // Purple with transparency
            if (typeof this.overlayCtx.roundRect === 'function') {
                this.overlayCtx.roundRect(rectX, rectY, rectWidth, rectHeight, borderRadius);
                this.overlayCtx.fill();
            } else {
                // Fallback: simple rectangle
                this.overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight);
            }
            
            // Add subtle border
            this.overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.overlayCtx.lineWidth = 2;
            this.overlayCtx.stroke();

            // Draw label text with shadow for better visibility
            this.overlayCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            this.overlayCtx.shadowBlur = 4;
            this.overlayCtx.shadowOffsetX = 2;
            this.overlayCtx.shadowOffsetY = 2;
            this.overlayCtx.fillStyle = '#FFFFFF';
            this.overlayCtx.fillText(fullText, x, y);
            
            // Reset shadow
            this.overlayCtx.shadowColor = 'transparent';
            this.overlayCtx.shadowBlur = 0;
            this.overlayCtx.shadowOffsetX = 0;
            this.overlayCtx.shadowOffsetY = 0;
        });
        
        // Draw status indicator after labels (so it appears at bottom)
        this.drawDetectionStatus(detectionCount || detections.length);
    }

}

// ============================================================================
// Initialize App
// ============================================================================

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new AppController();
});

