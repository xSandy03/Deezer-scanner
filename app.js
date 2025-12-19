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

// Emoji Labels - Matching the images in /Emojis/Purple Cube/
// Order matters: index 0 = first class, index 1 = second class, etc.
// Update this to match your model's output class order
const EMOJI_LABELS = [
    'Chill',      // Class 0 - Chill.JPG
    'Confused',   // Class 1 - Confused.JPG
    'Dreamy',     // Class 2 - Dreamy.JPG
    'Energy',     // Class 3 - Energy.JPG
    'Happy',      // Class 4 - Happy.JPG
    'Sad',        // Class 5 - Sad.JPG
];

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
        this.emojiLabels = EMOJI_LABELS; // Use labels from config
        this.detectedTargets = new Map(); // Track detected targets by targetIndex
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
                
                // Try to get the system from the scene
                this.mindarSystem = this.scene.systems['mindar-image'];
                
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

            // Ensure video elements are properly configured for mobile
            this.ensureVideoPlayback();
            
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
     */
    setupMindAREvents() {
        console.log('Setting up MindAR event listeners...');
        
        let targetsSetup = false;
        
        // Listen for arReady event (fires when camera is ready)
        this.scene.addEventListener('arReady', () => {
            console.log('✓ MindAR arReady event fired - camera should be active');
            console.log('MindAR system state:', this.mindarSystem);
            if (!targetsSetup) {
                // Wait a bit for MindAR to fully initialize
                setTimeout(() => {
                    this.setupTargetEntities();
                    targetsSetup = true;
                }, 500);
            }
        }, { once: true });
        
        // Listen for arError event
        this.scene.addEventListener('arError', (event) => {
            console.error('❌ MindAR error:', event.detail);
        });
        
        // Listen for renderstart to know when camera might be ready
        this.scene.addEventListener('renderstart', () => {
            console.log('Scene render started');
        });
        
        // Check if camera video element exists (MindAR creates it)
        const checkCamera = () => {
            const video = this.scene.querySelector('video');
            if (video) {
                console.log('✓ Camera video element found:', {
                    readyState: video.readyState,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    playing: !video.paused
                });
            } else {
                console.log('Camera video element not found yet');
            }
        };
        
        // Check immediately and after a delay
        setTimeout(checkCamera, 500);
        setTimeout(checkCamera, 2000);
        
        // Also try setting up targets if arReady hasn't fired after a delay
        setTimeout(() => {
            if (!targetsSetup && this.scene.hasLoaded) {
                console.log('Setting up targets after delay (arReady may have already fired)');
                this.setupTargetEntities();
                targetsSetup = true;
            }
        }, 2000);
    }
    
    setupTargetEntities() {
        console.log('Creating target entities for', this.emojiLabels.length, 'targets');
        
        // Check if targets already exist
        const existingTargets = this.scene.querySelectorAll('a-mindar-image-target');
        if (existingTargets.length > 0) {
            console.log('Target entities already exist, removing old ones');
            existingTargets.forEach(el => el.remove());
        }
        
        // Create target entities for each emoji (0-5 for 6 emojis)
        for (let i = 0; i < this.emojiLabels.length; i++) {
            const label = this.emojiLabels[i] || `Target ${i}`;
            const targetEl = document.createElement('a-mindar-image-target');
            targetEl.setAttribute('targetIndex', i);
            targetEl.id = `target-${i}`;
            targetEl.setAttribute('visible', true);
            
            // Listen for target found/lost events on each target entity
            targetEl.addEventListener('targetFound', (event) => {
                console.log(`🎯🎯🎯 Target ${i} (${label}) FOUND!`, event);
                console.log('Event detail:', event.detail);
                console.log('Target element:', targetEl);
                
                this.detectedTargets.set(i, {
                    targetIndex: i,
                    label,
                    confidence: 1.0,
                    found: true,
                    timestamp: Date.now()
                });
                
                console.log('Current detected targets map:', Array.from(this.detectedTargets.entries()));
                console.log('Detected targets count:', this.detectedTargets.size);
            });
            
            targetEl.addEventListener('targetLost', (event) => {
                console.log(`❌❌❌ Target ${i} (${label}) LOST`, event);
                this.detectedTargets.delete(i);
                console.log('Remaining detected targets:', Array.from(this.detectedTargets.keys()));
            });
            
            // Also listen on the scene for target events (some MindAR versions fire on scene)
            this.scene.addEventListener(`targetFound-${i}`, () => {
                console.log(`🎯 Scene event: Target ${i} (${label}) FOUND!`);
                this.detectedTargets.set(i, {
                    targetIndex: i,
                    label,
                    confidence: 1.0,
                    found: true,
                    timestamp: Date.now()
                });
            });
            
            // Add to scene
            this.scene.appendChild(targetEl);
            console.log(`✓ Created target entity for index ${i} (${label})`);
        }
        
        console.log(`✓ All ${this.emojiLabels.length} target entities created and added to scene`);
        
        // Verify targets were added
        const allTargets = this.scene.querySelectorAll('a-mindar-image-target');
        console.log(`Total target entities in scene: ${allTargets.length}`);
        
        // Log target details for debugging
        allTargets.forEach((target, idx) => {
            console.log(`Target ${idx}:`, {
                id: target.id,
                targetIndex: target.getAttribute('targetIndex'),
                visible: target.getAttribute('visible'),
                hasObject3D: !!target.object3D
            });
        });
        
        // Set up a periodic check to see if any targets become visible
        setInterval(() => {
            const visibleTargets = [];
            allTargets.forEach((targetEl) => {
                const targetIndex = parseInt(targetEl.getAttribute('targetIndex'));
                if (targetEl.object3D && targetEl.object3D.visible) {
                    visibleTargets.push(targetIndex);
                    // If target is visible but not in detectedTargets, add it
                    if (!this.detectedTargets.has(targetIndex)) {
                        const label = this.emojiLabels[targetIndex] || `Target ${targetIndex}`;
                        console.log(`🔍 Auto-detected visible target: ${targetIndex} (${label})`);
                        this.detectedTargets.set(targetIndex, {
                            targetIndex,
                            label,
                            confidence: 0.85,
                            found: true,
                            timestamp: Date.now()
                        });
                    }
                }
            });
            if (visibleTargets.length > 0) {
                console.log('Currently visible targets:', visibleTargets);
            }
        }, 1000); // Check every second
    }

    /**
     * Get current detections from MindAR
     * @returns {Array<{label: string, confidence: number, targetIndex: number}>} Current detections
     */
    getDetections() {
        if (!this.isLoaded) {
            return [];
        }

        // Also try to get detections directly from MindAR system if available
        if (this.mindarSystem && this.scene) {
            try {
                // Check if MindAR has a tracked targets method
                const trackedTargets = this.mindarSystem.controllers || [];
                if (trackedTargets.length > 0) {
                    console.log('MindAR tracked targets:', trackedTargets.length);
                }
            } catch (e) {
                // Ignore errors
            }
            
            // Check all target entities to see their visibility/status
            const allTargets = this.scene.querySelectorAll('a-mindar-image-target');
            allTargets.forEach((targetEl, index) => {
                const targetIndex = parseInt(targetEl.getAttribute('targetIndex'));
                const isVisible = targetEl.getAttribute('visible');
                const object3D = targetEl.object3D;
                if (object3D && object3D.visible) {
                    // Target is visible, might be detected
                    if (!this.detectedTargets.has(targetIndex)) {
                        const label = this.emojiLabels[targetIndex] || `Target ${targetIndex}`;
                        console.log(`🔍 Target ${targetIndex} (${label}) appears to be visible in scene`);
                        // Add it to detected targets as a fallback
                        this.detectedTargets.set(targetIndex, {
                            targetIndex,
                            label,
                            confidence: 0.9,
                            found: true,
                            timestamp: Date.now()
                        });
                    }
                }
            });
        }

        // Return up to 2 detected targets
        const detections = Array.from(this.detectedTargets.values())
            .slice(0, 2);
        
        if (detections.length > 0) {
            console.log('Returning detections:', detections.map(d => `${d.label} (${d.targetIndex})`));
        }
        
        return detections;
    }

    /**
     * Configure a single video element for mobile playback
     */
    configureVideoElement(video) {
        // Set mobile-specific attributes
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.setAttribute('muted', 'true');
        
        // Ensure muted property is set (required for autoplay)
        video.muted = true;
        
        // Ensure video is visible with inline styles (override any conflicting styles)
        video.style.position = 'fixed';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100vw';
        video.style.height = '100vh';
        video.style.objectFit = 'cover';
        video.style.display = 'block';
        video.style.visibility = 'visible';
        video.style.opacity = '1';
        video.style.zIndex = '0';
        video.style.backgroundColor = 'transparent';
        
        // Force play the video
        if (video.paused) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('✓ Video is now playing');
                }).catch(error => {
                    console.warn('⚠ Could not autoplay video:', error);
                });
            }
        }
    }
    
    /**
     * Ensure video elements are properly configured and playing on mobile
     */
    ensureVideoPlayback() {
        console.log('Ensuring video playback for mobile...');
        
        const processedVideos = new WeakSet();
        
        const findAndFixVideo = () => {
            // Find all video elements (including ones MindAR creates)
            const allVideos = document.querySelectorAll('video');
            
            console.log(`Found ${allVideos.length} video element(s)`);
            
            // Process all video elements
            allVideos.forEach((video, index) => {
                // Skip if already processed
                if (processedVideos.has(video)) {
                    return;
                }
                
                console.log(`Configuring video ${index}:`, {
                    id: video.id,
                    paused: video.paused,
                    readyState: video.readyState,
                    srcObject: !!video.srcObject,
                    playsinline: video.playsInline,
                    autoplay: video.autoplay,
                    muted: video.muted,
                    width: video.videoWidth,
                    height: video.videoHeight
                });
                
                this.configureVideoElement(video);
                processedVideos.add(video);
            });
        };
        
        // Try immediately and with delays (MindAR creates video elements asynchronously)
        findAndFixVideo();
        setTimeout(findAndFixVideo, 300);
        setTimeout(findAndFixVideo, 500);
        setTimeout(findAndFixVideo, 1000);
        setTimeout(findAndFixVideo, 2000);
        setTimeout(findAndFixVideo, 3000);
        
        // Watch for new video elements being added to DOM
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if it's a video element
                        if (node.tagName === 'VIDEO' && !processedVideos.has(node)) {
                            console.log('New video element detected, configuring...');
                            this.configureVideoElement(node);
                            processedVideos.add(node);
                        }
                        // Check for video elements inside added nodes
                        const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
                        videos.forEach(video => {
                            if (!processedVideos.has(video)) {
                                console.log('New video element in subtree, configuring...');
                                this.configureVideoElement(video);
                                processedVideos.add(video);
                            }
                        });
                    }
                });
            });
        });
        
        // Observe the scene and document body for new video elements
        if (this.scene) {
            observer.observe(this.scene, { childList: true, subtree: true });
        }
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Also listen for arReady to fix video when camera starts
        if (this.scene) {
            this.scene.addEventListener('arReady', () => {
                console.log('arReady event - fixing video elements');
                setTimeout(findAndFixVideo, 100);
            });
            
            this.scene.addEventListener('renderstart', () => {
                console.log('renderstart event - fixing video elements');
                setTimeout(findAndFixVideo, 100);
            });
        }
    }
    
    /**
     * Update emoji labels mapping
     * @param {Array<string>} labels - Array of emoji labels
     */
    setEmojiLabels(labels) {
        this.emojiLabels = labels;
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
                // Update emoji labels from config
                this.modelAdapter.setEmojiLabels(EMOJI_LABELS);
            } else {
                console.error('Failed to load MindAR model');
                // Don't block - continue anyway
                console.log('Continuing without AR tracking');
            }
        }

        // Start detection loop
        this.startDetection();
        
        // Draw status immediately
        setTimeout(() => {
            console.log('Drawing initial status, canvas:', this.overlayCanvas, 'ctx:', this.overlayCtx);
            this.drawDetectionStatus(0);
        }, 500);
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

            // Get current detections from MindAR
            const detections = this.modelAdapter.getDetections();
            
            if (detections.length > 0) {
                // Log detections periodically (not every frame)
                if (this.frameCount === undefined) this.frameCount = 0;
                this.frameCount++;
                if (this.frameCount % 30 === 0) { // Log every 30 frames (~1 second at 30fps)
                    console.log('🎯 MindAR detections:', detections.map(d => `${d.label} (${d.targetIndex})`));
                }
                
                // Convert to format expected by detection state
                const predictions = detections.map(d => ({
                    label: d.label,
                    confidence: d.confidence
                }));
                
                // Just draw status - user only wants status visible
                this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                this.drawDetectionStatus(detections.length);
                
                // Update state with smoothing
                const stateChanged = this.detectionState.update(predictions);
                
                if (stateChanged) {
                    // Switch playlist if combo changed
                    const comboKey = this.detectionState.getComboKey();
                    console.log('🔄 Switching playlist:', comboKey);
                    this.musicPlayer.switchPlaylist(comboKey);
                }
            } else {
                // Just draw status when no detections
                this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                this.drawDetectionStatus(0);
            }
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
            console.log('Canvas resized to:', this.overlayCanvas.width, this.overlayCanvas.height);
        }

        console.log('Drawing status, canvas size:', this.overlayCanvas.width, 'x', this.overlayCanvas.height);

        // Always show "Move camera towards Mood Cubes" message
        const statusText = 'Move camera towards Mood Cubes';
        
        // Use Deezer purple color #A238FF
        const bgColor = '#A238FF'; // Solid purple
        
        // Set font - use system font as fallback if Deezer font doesn't load
        this.overlayCtx.font = 'bold 28px "Deezer Product", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
        this.overlayCtx.textAlign = 'center';
        this.overlayCtx.textBaseline = 'middle';
        
        const textMetrics = this.overlayCtx.measureText(statusText);
        const textWidth = textMetrics.width;
        const textHeight = 32;
        const padding = 20;
        const margin = 40;
        
        // Center horizontally, position at bottom
        const x = this.overlayCanvas.width / 2;
        const y = this.overlayCanvas.height - margin;
        
        // Draw background rectangle
        const rectX = x - (textWidth / 2) - padding;
        const rectY = y - (textHeight / 2) - padding;
        const rectWidth = textWidth + (padding * 2);
        const rectHeight = textHeight + (padding * 2);
        
        // Draw background
        this.overlayCtx.fillStyle = bgColor;
        this.overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight);
        
        // Draw status text in white
        this.overlayCtx.fillStyle = '#FFFFFF';
        this.overlayCtx.fillText(statusText, x, y);
        
        console.log('Status drawn - bg at:', rectX, rectY, 'text at:', x, y, 'text:', statusText);
        console.log('Background color:', bgColor, 'Text color: white');
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

