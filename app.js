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
// COCO-SSD Model Adapter for Object Detection
// ============================================================================

class EmojiModelAdapter {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.emojiLabels = EMOJI_LABELS; // Use labels from config
    }

    /**
     * Load COCO-SSD pre-trained model for object detection
     */
    async loadModel() {
        try {
            if (CONFIG.MOCK_MODE) {
                console.log('Model loading skipped (MOCK_MODE enabled)');
                this.isLoaded = false;
                return true;
            }

            // Check if cocoSsd is available
            if (typeof cocoSsd === 'undefined') {
                console.error('COCO-SSD library not found! Make sure the script tag is loaded.');
                throw new Error('COCO-SSD model not loaded. Check script tag.');
            }

            // Load COCO-SSD model
            console.log('Loading COCO-SSD model...');
            this.model = await cocoSsd.load({
                base: 'mobilenet_v2'
            });
            this.isLoaded = true;
            console.log('COCO-SSD model loaded successfully');
            
            return true;
        } catch (error) {
            console.error('Error loading COCO-SSD model:', error);
            console.log('Continuing without model (will not detect)');
            this.isLoaded = false;
            return false;
        }
    }


    /**
     * Predict cube-like objects using COCO-SSD and return bounding boxes
     * @param {HTMLImageElement|ImageData|HTMLCanvasElement} image - Input image
     * @param {number} imageWidth - Original image width
     * @param {number} imageHeight - Original image height
     * @returns {Array<{label: string, confidence: number, bbox: {x: number, y: number, width: number, height: number}}>} Detections with bounding boxes
     */
    async predict(image, imageWidth, imageHeight) {
        if (!this.isLoaded || CONFIG.MOCK_MODE) {
            // Mock predictions for testing
            return this.mockPredict();
        }

        try {
            // Run COCO-SSD detection
            const detections = await this.model.detect(image);
            console.log('COCO-SSD detections:', detections.length, 'objects detected');
            
            if (detections.length === 0) {
                console.log('No objects detected in frame');
                return [];
            }
            
            // Sort by confidence score and limit to top 2 highest confidence detections
            const topDetections = detections
                .sort((a, b) => b.score - a.score)
                .slice(0, 2);
            
            console.log('Top 2 detections:', topDetections.map(d => ({ class: d.class, score: d.score })));
            
            // Map COCO-SSD detections to our format with emoji labels
            // For now, we'll use the class name, but you can add classification later
            const results = topDetections.map((detection, index) => {
                // Convert COCO-SSD bbox format (x, y, width, height) to our format
                const bbox = detection.bbox; // COCO-SSD bbox: [x, y, width, height]
                
                // Map detection to emoji label based on index or add classification logic here
                // For now, we'll use the first emoji label as placeholder
                // TODO: Add classification model to identify which emoji is on the cube
                const emojiLabel = this.emojiLabels[index] || detection.class;
                
                return {
                    label: emojiLabel,
                    confidence: detection.score,
                    bbox: {
                        x: bbox[0], // x coordinate
                        y: bbox[1], // y coordinate
                        width: bbox[2], // width
                        height: bbox[3] // height
                    },
                    className: detection.class // Store original COCO class for debugging
                };
            });
            
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

    /**
     * Update emoji labels mapping
     * @param {Array<string>} labels - Array of emoji labels
     */
    setEmojiLabels(labels) {
        this.emojiLabels = labels;
    }

    /**
     * Classify cropped region to determine which emoji is on the cube
     * TODO: Add custom classification model here to identify emoji from cropped region
     * @param {HTMLCanvasElement} croppedImage - Cropped region of detected object
     * @returns {string} Emoji label
     */
    async classifyEmoji(croppedImage) {
        // TODO: Implement custom emoji classification model
        // For now, return default or use heuristics
        return this.emojiLabels[0] || 'Unknown';
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
        this.overlayCanvas = document.getElementById('overlayCanvas');
        
        if (!this.video) {
            console.error('Video element not found!');
            return;
        }
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        if (!this.overlayCanvas) {
            console.error('Overlay canvas not found!');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
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

        // Load COCO-SSD model
        await this.modelAdapter.loadModel();
        
        // Update emoji labels from config
        this.modelAdapter.setEmojiLabels(EMOJI_LABELS);

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
                const videoWidth = this.video.videoWidth;
                const videoHeight = this.video.videoHeight;
                
                // Set canvas dimensions
                this.canvas.width = videoWidth;
                this.canvas.height = videoHeight;
                
                // Set overlay canvas dimensions to match video display size
                this.overlayCanvas.width = window.innerWidth;
                this.overlayCanvas.height = window.innerHeight;
                
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
                
                // Check if model is loaded
                if (!this.modelAdapter.isLoaded) {
                    console.log('Model not loaded yet, skipping detection');
                } else {
                    // Predict with bounding box support
                    const predictions = await this.modelAdapter.predict(
                        this.canvas, 
                        this.canvas.width, 
                        this.canvas.height
                    );
                    
                    console.log('Predictions received:', predictions.length);
                    
                    // Draw bounding boxes and labels on overlay
                    this.drawDetections(predictions);
                    
                    // Update state with smoothing (use top detection)
                    const stateChanged = this.detectionState.update(predictions);
                    
                    if (stateChanged) {
                        // Switch playlist if combo changed
                        const comboKey = this.detectionState.getComboKey();
                        this.musicPlayer.switchPlaylist(comboKey);
                    }
                }
            }
        }

        requestAnimationFrame(() => this.detectionLoop());
    }

    /**
     * Draw bounding boxes and labels for detected emojis
     * @param {Array<{label: string, confidence: number, bbox: {x: number, y: number, width: number, height: number}}>} detections
     */
    drawDetections(detections) {
        if (!this.overlayCanvas || !this.overlayCtx || !this.video) {
            console.warn('Cannot draw detections: missing overlay canvas or video element');
            return;
        }

        if (!detections || detections.length === 0) {
            // Clear overlay if no detections
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            return;
        }

        console.log('Drawing', detections.length, 'detections');

        // Clear previous drawings
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // Calculate scale factors to map from video dimensions to display dimensions
        const videoAspect = this.video.videoWidth / this.video.videoHeight;
        const displayAspect = window.innerWidth / window.innerHeight;
        
        let displayWidth, displayHeight, offsetX, offsetY;
        
        if (videoAspect > displayAspect) {
            // Video is wider - fit to height
            displayHeight = window.innerHeight;
            displayWidth = displayHeight * videoAspect;
            offsetX = (window.innerWidth - displayWidth) / 2;
            offsetY = 0;
        } else {
            // Video is taller - fit to width
            displayWidth = window.innerWidth;
            displayHeight = displayWidth / videoAspect;
            offsetX = 0;
            offsetY = (window.innerHeight - displayHeight) / 2;
        }
        
        const scaleX = displayWidth / this.video.videoWidth;
        const scaleY = displayHeight / this.video.videoHeight;

        // Draw each detection
        detections.forEach((detection, index) => {
            if (!detection.bbox) {
                console.warn('Detection missing bbox:', detection);
                return;
            }

            const bbox = detection.bbox;
            
            // Scale and offset bounding box coordinates
            const x = (bbox.x * scaleX) + offsetX;
            const y = (bbox.y * scaleY) + offsetY;
            const width = bbox.width * scaleX;
            const height = bbox.height * scaleY;

            // Draw bounding box
            this.overlayCtx.strokeStyle = '#A238FF'; // Purple color
            this.overlayCtx.lineWidth = 3;
            this.overlayCtx.strokeRect(x, y, width, height);

            // Draw label background
            const labelText = `${detection.label}`;
            const confidenceText = `${Math.round(detection.confidence * 100)}%`;
            const className = detection.className ? ` (${detection.className})` : '';
            const fullText = `${labelText} ${confidenceText}${className}`;
            
            this.overlayCtx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            const textMetrics = this.overlayCtx.measureText(fullText);
            const textWidth = textMetrics.width;
            const textHeight = 30;
            const padding = 10;
            
            // Draw label background rectangle
            const labelY = Math.max(y - textHeight - padding - 5, 0); // Position above box, or at top if too high
            this.overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.overlayCtx.fillRect(
                x - padding,
                labelY - padding,
                textWidth + (padding * 2),
                textHeight + padding
            );

            // Draw label text
            this.overlayCtx.fillStyle = '#FFFFFF';
            this.overlayCtx.fillText(fullText, x, labelY + 20);
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

