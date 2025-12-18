// Configuration
const REDIRECTS = {
    "emoji_fire": "https://example.com/fire",
    "emoji_heart": "https://example.com/heart",
    "emoji_check": "https://example.com/check"
};

const MODEL_PATH = "/model/model.json";
const INFERENCE_INTERVAL = 100; // ~10 FPS
const CONFIDENCE_THRESHOLD = 0.85;
const REQUIRED_CONSECUTIVE_FRAMES = 8;

// State
let model = null;
let video = null;
let canvas = null;
let ctx = null;
let stream = null;
let inferenceInterval = null;
let consecutiveMatches = 0;
let lastPredictedLabel = null;

// DOM elements
const elements = {
    video: document.getElementById('video'),
    canvas: document.getElementById('canvas'),
    status: document.getElementById('status'),
    errorMessage: document.getElementById('errorMessage')
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check if already redirected
    if (sessionStorage.getItem('redirected') === 'true') {
        showError('Redirect was triggered. Refresh page to scan again.');
        return;
    }

    // Check HTTPS/localhost
    if (!isSecureContext()) {
        showError('Camera access requires HTTPS or localhost.');
        return;
    }

    // Load model and start camera
    await loadModel();
    await startCamera();
});

async function loadModel() {
    try {
        elements.status.textContent = 'Loading model...';
        const modelURL = MODEL_PATH;
        const metadataURL = MODEL_PATH.replace('model.json', 'metadata.json');
        
        model = await tmImage.load(modelURL, metadataURL);
        elements.status.textContent = 'Ready';
        console.log('Model loaded successfully');
    } catch (error) {
        console.error('Error loading model:', error);
        showError(`Failed to load model. Please ensure the /model/ folder contains model.json, metadata.json, and weights.bin files.`);
        elements.status.textContent = 'Error';
    }
}

function isSecureContext() {
    return window.isSecureContext || 
           window.location.protocol === 'https:' || 
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1';
}

async function startCamera() {
    try {
        if (!model) {
            showError('Model not loaded. Please wait or check the model files.');
            return;
        }

        // Request camera
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        elements.video.srcObject = stream;
        await elements.video.play();

        // Setup canvas
        canvas = elements.canvas;
        ctx = canvas.getContext('2d');
        
        // Wait for video to be ready
        await new Promise(resolve => {
            elements.video.addEventListener('loadedmetadata', resolve, { once: true });
        });

        canvas.width = elements.video.videoWidth;
        canvas.height = elements.video.videoHeight;

        // Update UI
        elements.status.textContent = 'Scanning...';
        elements.status.classList.add('detecting');
        hideError();

        // Start inference loop
        startInferenceLoop();

    } catch (error) {
        console.error('Error accessing camera:', error);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            showError('Camera permission denied. Please allow camera access and refresh.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            showError('No camera found. Please connect a camera device.');
        } else {
            showError(`Error accessing camera: ${error.message}`);
        }
        elements.status.textContent = 'Error';
    }
}

function startInferenceLoop() {
    if (inferenceInterval) {
        clearInterval(inferenceInterval);
    }

    inferenceInterval = setInterval(async () => {
        if (!model || !elements.video.readyState) {
            return;
        }

        await runInference();
    }, INFERENCE_INTERVAL);
}

async function runInference() {
    try {
        if (!canvas || !ctx || !elements.video.readyState) {
            return;
        }

        // Calculate ROI (centered square, scaled to video dimensions)
        const videoWidth = elements.video.videoWidth;
        const videoHeight = elements.video.videoHeight;
        const roiSize = Math.min(videoWidth, videoHeight) * 0.4; // 40% of smaller dimension
        const roiX = (videoWidth - roiSize) / 2;
        const roiY = (videoHeight - roiSize) / 2;

        // Create temporary canvas for ROI (extract directly from video, no flip needed for model)
        const roiCanvas = document.createElement('canvas');
        roiCanvas.width = roiSize;
        roiCanvas.height = roiSize;
        const roiCtx = roiCanvas.getContext('2d');
        
        // Draw the ROI region directly from video to ROI canvas
        roiCtx.drawImage(
            elements.video,
            roiX, roiY, roiSize, roiSize,  // Source: ROI from video
            0, 0, roiSize, roiSize         // Destination: full ROI canvas
        );

        // Run prediction
        const prediction = await model.predict(roiCanvas);
        const topPrediction = prediction[0];

        // Update status
        elements.status.textContent = 'Scanning...';

        // Check if we should redirect
        if (topPrediction.className && REDIRECTS[topPrediction.className]) {
            if (topPrediction.probability >= CONFIDENCE_THRESHOLD) {
                if (topPrediction.className === lastPredictedLabel) {
                    consecutiveMatches++;
                } else {
                    consecutiveMatches = 1;
                    lastPredictedLabel = topPrediction.className;
                }

                if (consecutiveMatches >= REQUIRED_CONSECUTIVE_FRAMES) {
                    handleRedirect(topPrediction.className);
                }
            } else {
                consecutiveMatches = 0;
                lastPredictedLabel = null;
            }
        } else {
            consecutiveMatches = 0;
            lastPredictedLabel = null;
        }

    } catch (error) {
        console.error('Error during inference:', error);
    }
}

function handleRedirect(label) {
    const redirectURL = REDIRECTS[label];
    
    if (!redirectURL) {
        console.warn('No redirect URL for label:', label);
        return;
    }

    // Check if already redirected
    if (sessionStorage.getItem('redirected') === 'true') {
        return;
    }

    // Set redirect flag
    sessionStorage.setItem('redirected', 'true');

    // Update UI
    elements.status.textContent = 'Redirecting...';
    elements.status.classList.remove('detecting');
    elements.status.classList.add('redirecting');

    // Stop camera
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    if (inferenceInterval) {
        clearInterval(inferenceInterval);
        inferenceInterval = null;
    }

    // Redirect after a brief delay
    setTimeout(() => {
        window.location.href = redirectURL;
    }, 500);
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
    elements.errorMessage.classList.add('show');
}

function hideError() {
    elements.errorMessage.style.display = 'none';
    elements.errorMessage.classList.remove('show');
}
