/**
 * CUBE AR - WebAR Application
 * Multi-target image tracking with video and audio playback
 */

(function() {
    'use strict';

    // ============================================
    // State Management
    // ============================================
    const state = {
        // Currently detected target indices
        detectedTargets: new Set(),
        
        // Last found target index (for audio priority)
        lastFoundIndex: null,
        
        // Currently playing audio target index
        currentAudioIndex: null,
        
        // Audio muted state
        audioMuted: true,
        
        // Debug mode
        debugMode: false,
        
        // Initialized state
        initialized: false,
        
        // AR system ready
        arReady: false
    };

    // ============================================
    // DOM Elements
    // ============================================
    const elements = {
        startOverlay: document.getElementById('start-overlay'),
        ui: document.getElementById('ui'),
        scene: document.getElementById('scene'),
        statusText: document.getElementById('status-text'),
        statusDetail: document.getElementById('status-detail'),
        statusIndicator: document.querySelector('.status-indicator'),
        helpBtn: document.getElementById('help-btn'),
        helpModal: document.getElementById('help-modal'),
        closeHelp: document.getElementById('close-help'),
        debugBtn: document.getElementById('debug-btn'),
        muteBtn: document.getElementById('mute-btn')
    };

    // ============================================
    // Audio Management
    // ============================================
    const audioElements = {};
    const videoElements = {};

    /**
     * Initialize audio elements for all targets
     */
    function initAudioElements() {
        for (let i = 0; i < 12; i++) {
            const audio = new Audio();
            audio.src = `./a${i}.mp3`;
            audio.loop = true;
            audio.preload = 'metadata';
            audio.volume = 1.0;
            audioElements[i] = audio;
        }
    }

    /**
     * Initialize video elements (will be created in A-Frame)
     */
    function initVideoElements() {
        // Videos are created as A-Frame entities, stored in videoElements map
        // This is handled in createTargetEntities()
    }

    /**
     * Play audio for a specific target index
     */
    function playAudioForTarget(targetIndex) {
        if (state.audioMuted) return;
        
        const audio = audioElements[targetIndex];
        if (!audio) return;

        // Stop current audio if different
        if (state.currentAudioIndex !== null && state.currentAudioIndex !== targetIndex) {
            const currentAudio = audioElements[state.currentAudioIndex];
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
        }

        // Play new audio
        audio.currentTime = 0;
        audio.play().catch(err => {
            console.warn(`Failed to play audio for target ${targetIndex}:`, err);
        });
        
        state.currentAudioIndex = targetIndex;
        updateStatusDetail(`Audio: Target ${targetIndex}`);
    }

    /**
     * Stop audio for a specific target
     */
    function stopAudioForTarget(targetIndex) {
        const audio = audioElements[targetIndex];
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        
        if (state.currentAudioIndex === targetIndex) {
            state.currentAudioIndex = null;
        }
    }

    /**
     * Handle audio priority when multiple targets detected
     */
    function updateAudioPlayback() {
        if (state.detectedTargets.size === 0) {
            // No targets detected, stop all audio
            if (state.currentAudioIndex !== null) {
                stopAudioForTarget(state.currentAudioIndex);
                updateStatusDetail('');
            }
        } else if (state.detectedTargets.size === 1) {
            // Single target detected, play its audio
            const targetIndex = Array.from(state.detectedTargets)[0];
            if (state.currentAudioIndex !== targetIndex) {
                playAudioForTarget(targetIndex);
            }
        } else {
            // Multiple targets detected, use last found priority
            if (state.lastFoundIndex !== null && state.detectedTargets.has(state.lastFoundIndex)) {
                if (state.currentAudioIndex !== state.lastFoundIndex) {
                    playAudioForTarget(state.lastFoundIndex);
                }
            } else {
                // Last found target is lost, switch to another detected target
                const availableTargets = Array.from(state.detectedTargets);
                if (availableTargets.length > 0) {
                    const newTarget = availableTargets[0];
                    playAudioForTarget(newTarget);
                    state.lastFoundIndex = newTarget;
                }
            }
        }
    }

    // ============================================
    // Video Management
    // ============================================
    /**
     * Play video for a specific target
     */
    function playVideoForTarget(targetIndex) {
        const video = videoElements[targetIndex];
        if (!video) return;

        const videoEl = video.getObject3D('mesh').material.map.image;
        if (videoEl && videoEl.tagName === 'VIDEO') {
            videoEl.currentTime = 0;
            videoEl.play().catch(err => {
                console.warn(`Failed to play video for target ${targetIndex}:`, err);
            });
        }
    }

    /**
     * Pause video for a specific target
     */
    function pauseVideoForTarget(targetIndex) {
        const video = videoElements[targetIndex];
        if (!video) return;

        const videoEl = video.getObject3D('mesh').material.map.image;
        if (videoEl && videoEl.tagName === 'VIDEO') {
            videoEl.pause();
        }
    }

    // ============================================
    // A-Frame Custom Component
    // ============================================
    AFRAME.registerComponent('target-controller', {
        schema: {
            targetIndex: { type: 'number', default: 0 }
        },

        init: function() {
            this.targetIndex = this.data.targetIndex;
            this.isDetected = false;
            
            // Listen for MindAR events
            this.el.addEventListener('targetFound', () => {
                this.onTargetFound();
            });
            
            this.el.addEventListener('targetLost', () => {
                this.onTargetLost();
            });
        },

        onTargetFound: function() {
            if (this.isDetected) return;
            this.isDetected = true;
            
            if (state.debugMode) {
                console.log(`Target ${this.targetIndex} found`);
            }
            
            // Add to detected targets
            state.detectedTargets.add(this.targetIndex);
            state.lastFoundIndex = this.targetIndex;
            
            // Play video
            playVideoForTarget(this.targetIndex);
            
            // Update audio playback
            updateAudioPlayback();
            
            // Update UI
            updateStatus();
        },

        onTargetLost: function() {
            if (!this.isDetected) return;
            this.isDetected = false;
            
            if (state.debugMode) {
                console.log(`Target ${this.targetIndex} lost`);
            }
            
            // Remove from detected targets
            state.detectedTargets.delete(this.targetIndex);
            
            // Pause video
            pauseVideoForTarget(this.targetIndex);
            
            // Update audio playback
            updateAudioPlayback();
            
            // Update UI
            updateStatus();
        }
    });

    // ============================================
    // Target Entity Creation
    // ============================================
    /**
     * Create A-Frame entities for all 12 targets
     */
    function createTargetEntities() {
        const scene = elements.scene;
        
        for (let i = 0; i < 12; i++) {
            // Create entity for this target
            const entity = document.createElement('a-entity');
            entity.setAttribute('mindar-image-target', `targetIndex: ${i}`);
            entity.setAttribute('target-controller', `targetIndex: ${i}`);
            
            // Create video plane
            const videoPlane = document.createElement('a-plane');
            videoPlane.setAttribute('width', '1');
            videoPlane.setAttribute('height', '1');
            videoPlane.setAttribute('position', '0 0 0.03');
            videoPlane.setAttribute('rotation', '0 0 0');
            videoPlane.setAttribute('material', `shader: flat; src: ./v${i}.mp4; autoplay: false; loop: true; playsinline: true; muted: true`);
            
            entity.appendChild(videoPlane);
            scene.appendChild(entity);
            
            // Store reference
            videoElements[i] = videoPlane;
        }
    }

    // ============================================
    // UI Updates
    // ============================================
    /**
     * Update status indicator
     */
    function updateStatus() {
        const count = state.detectedTargets.size;
        
        if (count === 0) {
            elements.statusText.textContent = 'Scanning';
            elements.statusIndicator.className = 'status-indicator scanning';
            elements.statusDetail.textContent = '';
        } else {
            elements.statusText.textContent = 'Target Detected';
            elements.statusIndicator.className = 'status-indicator detected';
            if (count > 1) {
                elements.statusDetail.textContent = `${count} targets`;
            } else {
                elements.statusDetail.textContent = '';
            }
        }
    }

    /**
     * Update status detail text
     */
    function updateStatusDetail(text) {
        elements.statusDetail.textContent = text;
    }

    /**
     * Update mute button state
     */
    function updateMuteButton() {
        if (state.audioMuted) {
            elements.muteBtn.textContent = '🔇';
            elements.muteBtn.classList.add('muted');
        } else {
            elements.muteBtn.textContent = '🔊';
            elements.muteBtn.classList.remove('muted');
        }
    }

    // ============================================
    // User Interaction
    // ============================================
    /**
     * Handle tap to start
     */
    function handleTapToStart() {
        if (state.initialized) return;
        
        // Unlock video playback
        for (let i = 0; i < 12; i++) {
            const video = videoElements[i];
            if (video) {
                const videoEl = video.getObject3D('mesh').material.map.image;
                if (videoEl && videoEl.tagName === 'VIDEO') {
                    videoEl.muted = true;
                    videoEl.playsInline = true;
                    videoEl.loop = true;
                    // Attempt play/pause to unlock
                    videoEl.play().then(() => {
                        videoEl.pause();
                    }).catch(() => {});
                }
            }
        }
        
        // Unlock audio playback
        for (let i = 0; i < 12; i++) {
            const audio = audioElements[i];
            if (audio) {
                audio.muted = false;
                // Attempt play/pause to unlock
                audio.play().then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                }).catch(() => {});
            }
        }
        
        // Hide overlay, show UI and scene
        elements.startOverlay.style.display = 'none';
        elements.ui.style.display = 'block';
        elements.scene.style.display = 'block';
        
        // Start AR system
        const arSystem = elements.scene.systems['mindar-image-system'];
        if (arSystem) {
            arSystem.start().then(() => {
                state.arReady = true;
                updateStatus();
            }).catch(err => {
                console.error('Failed to start AR system:', err);
                alert('Failed to start AR. Please ensure camera permissions are granted.');
            });
        }
        
        state.initialized = true;
    }

    /**
     * Toggle mute/unmute
     */
    function toggleMute() {
        state.audioMuted = !state.audioMuted;
        
        if (state.audioMuted) {
            // Mute: stop all audio
            if (state.currentAudioIndex !== null) {
                stopAudioForTarget(state.currentAudioIndex);
            }
        } else {
            // Unmute: resume audio if target is detected
            updateAudioPlayback();
        }
        
        updateMuteButton();
    }

    /**
     * Toggle debug mode
     */
    function toggleDebug() {
        state.debugMode = !state.debugMode;
        
        const arSystem = elements.scene.systems['mindar-image-system'];
        if (arSystem) {
            arSystem.ui = state.debugMode;
        }
        
        elements.debugBtn.style.backgroundColor = state.debugMode 
            ? '#A238FF' 
            : 'rgba(162, 56, 255, 0.2)';
        
        if (state.debugMode) {
            console.log('Debug mode enabled');
        }
    }

    /**
     * Show help modal
     */
    function showHelp() {
        elements.helpModal.style.display = 'flex';
    }

    /**
     * Hide help modal
     */
    function hideHelp() {
        elements.helpModal.style.display = 'none';
    }

    // ============================================
    // Initialization
    // ============================================
    /**
     * Initialize the application
     */
    function init() {
        // Initialize audio elements
        initAudioElements();
        
        // Wait for A-Frame scene to load
        elements.scene.addEventListener('loaded', () => {
            // Create target entities
            createTargetEntities();
            initVideoElements();
        });
        
        // Event listeners
        elements.startOverlay.addEventListener('click', handleTapToStart);
        elements.startOverlay.addEventListener('touchend', handleTapToStart);
        
        elements.muteBtn.addEventListener('click', toggleMute);
        elements.debugBtn.addEventListener('click', toggleDebug);
        elements.helpBtn.addEventListener('click', showHelp);
        elements.closeHelp.addEventListener('click', hideHelp);
        
        // Close help modal on background click
        elements.helpModal.addEventListener('click', (e) => {
            if (e.target === elements.helpModal) {
                hideHelp();
            }
        });
        
        // Initial UI state
        updateMuteButton();
        elements.statusText.textContent = 'Ready';
        
        // Prevent context menu on long press
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        
        console.log('CUBE AR initialized');
    }

    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
