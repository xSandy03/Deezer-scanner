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

            // Wait for A-Frame to be ready
            if (typeof AFRAME === 'undefined') {
                throw new Error('A-Frame not loaded. Make sure script tag is present.');
            }

            await new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                }
            });

            const sceneEl = document.getElementById('arScene');
            if (!sceneEl) {
                throw new Error('AR scene element not found');
            }

            this.scene = sceneEl;
            
            // Wait for scene to be ready
            await new Promise(resolve => {
                if (this.scene.hasLoaded) {
                    resolve();
                } else {
                    this.scene.addEventListener('loaded', resolve);
                }
            });

            // Get MindAR system
            this.mindarSystem = this.scene.systems['mindar-image-system'];
            if (!this.mindarSystem) {
                throw new Error('MindAR system not found. Check targets.mind file path.');
            }

            // Set up event listeners for target detection
            this.setupMindAREvents();

            // Start MindAR tracking (this will request camera access)
            await this.mindarSystem.start();
            console.log('MindAR started, camera should be active');

            this.isLoaded = true;
            console.log('MindAR loaded successfully');
            
            return true;
        } catch (error) {
            console.error('Error loading MindAR:', error);
            this.isLoaded = false;
            return false;
        }
    }

    /**
     * Set up MindAR event listeners for target tracking
     */
    setupMindAREvents() {
        // MindAR fires events on individual target entities
        // We need to listen to all target entities in the scene
        this.scene.addEventListener('arReady', () => {
            console.log('MindAR ready, setting up target listeners');
            
            // Create target entities for each emoji (0-5 for 6 emojis)
            for (let i = 0; i < this.emojiLabels.length; i++) {
                const targetEl = document.createElement('a-mindar-image-target');
                targetEl.setAttribute('targetIndex', i);
                targetEl.id = `target-${i}`;
                
                // Listen for target found/lost events on each target entity
                targetEl.addEventListener('targetFound', () => {
                    const label = this.emojiLabels[i] || `Target ${i}`;
                    console.log('Target found:', i, label);
                    
                    this.detectedTargets.set(i, {
                        targetIndex: i,
                        label,
                        confidence: 1.0,
                        found: true
                    });
                });
                
                targetEl.addEventListener('targetLost', () => {
                    console.log('Target lost:', i);
                    this.detectedTargets.delete(i);
                });
                
                this.scene.appendChild(targetEl);
            }
        });
    }

    /**
     * Get current detections from MindAR
     * @returns {Array<{label: string, confidence: number, targetIndex: number}>} Current detections
     */
    getDetections() {
        if (!this.isLoaded) {
            return [];
        }

        // Return up to 2 detected targets
        const detections = Array.from(this.detectedTargets.values())
            .slice(0, 2);
        
        return detections;
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
        
        // Hide start overlay and show app
        const startOverlay = document.getElementById('startOverlay');
        const app = document.getElementById('app');
        if (startOverlay) startOverlay.classList.add('hidden');
        if (app) {
            app.classList.remove('hidden');
            console.log('App container is now visible');
        }

        // Set overlay canvas size
        this.overlayCanvas.width = window.innerWidth;
        this.overlayCanvas.height = window.innerHeight;

        // Load MindAR model (handles camera internally)
        if (!CONFIG.MOCK_MODE) {
            console.log('Loading MindAR...');
            const loaded = await this.modelAdapter.loadModel();
            if (loaded) {
                console.log('MindAR model loaded successfully');
                // Update emoji labels from config
                this.modelAdapter.setEmojiLabels(EMOJI_LABELS);
            } else {
                console.error('Failed to load MindAR model');
                alert('Failed to load AR tracking. Please check console for errors.');
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

            // Get current detections from MindAR
            const detections = this.modelAdapter.getDetections();
            
            if (detections.length > 0) {
                console.log('MindAR detections:', detections.length);
                
                // Convert to format expected by detection state
                const predictions = detections.map(d => ({
                    label: d.label,
                    confidence: d.confidence
                }));
                
                // Draw labels on overlay
                this.drawMindARDetections(detections);
                
                // Update state with smoothing
                const stateChanged = this.detectionState.update(predictions);
                
                if (stateChanged) {
                    // Switch playlist if combo changed
                    const comboKey = this.detectionState.getComboKey();
                    this.musicPlayer.switchPlaylist(comboKey);
                }
            } else {
                // Clear overlay if no detections
                this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            }
        }

        requestAnimationFrame(() => this.detectionLoop());
    }

    /**
     * Draw labels for MindAR detected targets
     * @param {Array<{label: string, confidence: number, targetIndex: number}>} detections
     */
    drawMindARDetections(detections) {
        if (!this.overlayCanvas || !this.overlayCtx) {
            console.warn('Cannot draw detections: missing overlay canvas');
            return;
        }

        if (!detections || detections.length === 0) {
            // Clear overlay if no detections
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            return;
        }

        // Clear previous drawings
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // Draw labels for each detection
        // Position labels at top of screen, staggered for multiple detections
        detections.forEach((detection, index) => {
            const labelText = `${detection.label}`;
            const confidenceText = `${Math.round(detection.confidence * 100)}%`;
            const fullText = `${labelText} ${confidenceText}`;
            
            this.overlayCtx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            const textMetrics = this.overlayCtx.measureText(fullText);
            const textWidth = textMetrics.width;
            const textHeight = 40;
            const padding = 15;
            
            // Position labels at top center, staggered
            const x = (this.overlayCanvas.width - textWidth) / 2;
            const y = 80 + (index * (textHeight + padding + 20));
            
            // Draw label background rectangle
            this.overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.overlayCtx.fillRect(
                x - padding,
                y - textHeight - padding,
                textWidth + (padding * 2),
                textHeight + (padding * 2)
            );

            // Draw label text
            this.overlayCtx.fillStyle = '#FFFFFF';
            this.overlayCtx.fillText(fullText, x, y);
        });
    }

}

// ============================================================================
// Initialize App
// ============================================================================

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new AppController();
});

