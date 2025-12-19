// ============================================================================
// Emoji Detection Music Player
// ============================================================================

// Configuration
const CONFIG = {
    CONFIDENCE_THRESHOLD: 0.75,
    SMOOTHING_FRAMES: 8, // Number of consecutive frames required for stable detection
    DETECTION_FPS: 10, // Frames per second for detection (throttled)
    LOW_POWER_FPS: 5, // FPS when low power mode is enabled
    MODEL_PATH: './emoji-model/model.json', // Path to TensorFlow.js model
    MOCK_MODE: false, // Set to true for testing without camera
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
// Model Adapter Class
// ============================================================================

class EmojiModelAdapter {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.inputSize = [224, 224]; // Default input size, adjust based on your model
    }

    /**
     * Load TensorFlow.js model from local files
     * TODO: Replace this with your actual model loading logic
     * Model should be exported from Teachable Machine or similar tool
     * Expected structure: /emoji-model/model.json and weight files
     */
    async loadModel() {
        try {
            // TODO: Uncomment when model files are ready
            // this.model = await tf.loadLayersModel(CONFIG.MODEL_PATH);
            // this.isLoaded = true;
            // console.log('Model loaded successfully');
            
            // For now, return mock success
            console.log('Model loading skipped (mock mode)');
            this.isLoaded = false;
            return true;
        } catch (error) {
            console.error('Error loading model:', error);
            this.isLoaded = false;
            return false;
        }
    }

    /**
     * Preprocess image for model input
     * @param {HTMLImageElement|ImageData|HTMLCanvasElement} image - Input image
     * @returns {tf.Tensor} Preprocessed tensor
     */
    preprocess(image) {
        // TODO: Adjust preprocessing based on your model requirements
        // Common preprocessing: resize, normalize, convert to tensor
        return tf.tidy(() => {
            let tensor = tf.browser.fromPixels(image);
            tensor = tf.image.resizeBilinear(tensor, this.inputSize);
            tensor = tensor.div(255.0); // Normalize to [0, 1]
            tensor = tensor.expandDims(0); // Add batch dimension
            return tensor;
        });
    }

    /**
     * Predict emojis from image
     * @param {HTMLImageElement|ImageData|HTMLCanvasElement} image - Input image
     * @returns {Array<{label: string, confidence: number}>} Top predictions
     */
    async predict(image) {
        if (!this.isLoaded || CONFIG.MOCK_MODE) {
            // Mock predictions for testing
            return this.mockPredict();
        }

        try {
            const preprocessed = this.preprocess(image);
            const predictions = await this.model.predict(preprocessed);
            const data = await predictions.data();
            
            // TODO: Map predictions to emoji labels
            // This depends on your model's output structure
            // Example: if model outputs class probabilities, map indices to emoji labels
            const emojiLabels = ['😄', '😈', '🎵', '🔥', '❤️', '⭐']; // TODO: Replace with actual labels
            
            const results = Array.from(data)
                .map((confidence, index) => ({
                    label: emojiLabels[index] || `Emoji${index}`,
                    confidence: confidence
                }))
                .sort((a, b) => b.confidence - a.confidence)
                .filter(p => p.confidence >= CONFIG.CONFIDENCE_THRESHOLD);
            
            preprocessed.dispose();
            predictions.dispose();
            
            return results;
        } catch (error) {
            console.error('Prediction error:', error);
            return [];
        }
    }

    /**
     * Mock predictions for testing without model
     */
    mockPredict() {
        // Return empty array - mock mode will use dropdown instead
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
        
        this.video = document.getElementById('videoElement');
        this.canvas = document.getElementById('canvasElement');
        
        if (!this.video) {
            console.error('Video element not found!');
            return;
        }
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        this.isDetecting = false;
        this.lastDetectionTime = 0;
        this.detectionInterval = 1000 / CONFIG.DETECTION_FPS;
        
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
        
        // Hide start overlay
        const startOverlay = document.getElementById('startOverlay');
        const app = document.getElementById('app');
        if (startOverlay) startOverlay.classList.add('hidden');
        if (app) {
            app.classList.remove('hidden');
            console.log('App container is now visible');
        }

        // Start camera first (camera works independently of model)
        // Only request camera access after user explicitly clicks "Tap to Start"
        if (!CONFIG.MOCK_MODE) {
            console.log('Starting camera...');
            await this.startCamera();
        } else {
            console.log('Skipping camera (MOCK_MODE is true)');
        }

        // Load model (optional - camera can work without it)
        await this.modelAdapter.loadModel();

        // Start detection loop
        this.startDetection();
    }

    async startCamera() {
        try {
            // Check if getUserMedia is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia is not supported in this browser');
            }

            console.log('Requesting camera access...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Rear camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            console.log('Camera access granted, setting up video element...');
            this.video.srcObject = stream;
            
            // Ensure video is visible and playing
            this.video.style.display = 'block';
            
            // Set canvas size to match video and play video
            this.video.addEventListener('loadedmetadata', () => {
                console.log('Video metadata loaded, dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                // Start playing video
                this.video.play().then(() => {
                    console.log('Video is playing');
                }).catch(err => {
                    console.error('Video play error:', err);
                });
            });

            // Also try to play immediately
            this.video.play().catch(err => {
                console.log('Initial play attempt failed (expected), will retry after metadata loads');
            });

        } catch (error) {
            console.error('Camera error:', error);
            alert('Camera access denied or not available: ' + error.message);
            // Fall back to mock mode
            CONFIG.MOCK_MODE = true;
        }
    }

    startDetection() {
        this.isDetecting = true;
        this.detectionLoop();
    }

    async detectionLoop() {
        if (!this.isDetecting) return;

        const now = Date.now();
        const shouldDetect = (now - this.lastDetectionTime) >= this.detectionInterval;

        if (shouldDetect) {
            this.lastDetectionTime = now;

            if (!CONFIG.MOCK_MODE) {
                // Real detection
                // Capture frame
                this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
                
                // Predict
                const predictions = await this.modelAdapter.predict(this.canvas);
                
                // Update state with smoothing
                const stateChanged = this.detectionState.update(predictions);
                
                if (stateChanged) {
                    // Switch playlist if combo changed
                    const comboKey = this.detectionState.getComboKey();
                    this.musicPlayer.switchPlaylist(comboKey);
                }
            }
        }

        requestAnimationFrame(() => this.detectionLoop());
    }

}

// ============================================================================
// Initialize App
// ============================================================================

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new AppController();
});
