# Emoji Detection Music Player

A mobile-first web app that uses your device camera to detect emojis from two cubes and plays music based on the detected emoji combination. Built with TensorFlow.js for client-side detection and designed for GitHub Pages deployment.

## Features

- 📷 **Live Camera Detection**: Uses device camera to detect emojis in real-time
- 🎯 **Dual Emoji Detection**: Detects up to two emojis simultaneously with smoothing for stability
- 🎵 **Dynamic Playlists**: Automatically switches music based on emoji combinations
- 🎨 **Deezer-like UI**: Clean, modern design with purple accents (#A238FF)
- 📱 **Mobile Optimized**: Works on iPhone Safari and Android Chrome
- 🔋 **Low Power Mode**: Reduce detection rate to save battery
- 🧪 **Mock Mode**: Test without camera using dropdown controls

## Project Structure

```
Deezer/
├── index.html          # Main HTML file
├── styles.css          # Stylesheet
├── app.js              # Main application logic
├── emoji-model/        # TensorFlow.js model files (see below)
│   └── model.json      # Model configuration
│   └── weights/        # Model weights
├── assets/
│   └── audio/          # Audio files (MP3 format)
└── README.md           # This file
```

## Setup Instructions

### 1. Hosting on GitHub Pages

1. Create a new GitHub repository
2. Push all files to the repository
3. Go to Settings → Pages
4. Select your branch (usually `main` or `master`)
5. Your app will be available at `https://[username].github.io/[repository-name]/`

### 2. Adding Audio Files

1. Place your MP3 files in the `assets/audio/` folder
2. Update `COMBO_PLAYLISTS` in `app.js`:

```javascript
const COMBO_PLAYLISTS = {
    '😄|😈': [
        { 
            title: 'Your Track Name', 
            artist: 'Artist Name', 
            src: './assets/audio/your-file.mp3' 
        },
        // Add more tracks...
    ],
    // Add more combinations...
};
```

**Important Notes:**
- Use relative paths starting with `./assets/audio/`
- File names should not contain spaces (use hyphens or underscores)
- Supported formats: MP3 (most compatible across browsers)

### 3. Editing Playlist Mappings

The `COMBO_PLAYLISTS` object in `app.js` maps emoji combinations to playlists:

- **Order-independent**: `'😄|😈'` and `'😈|😄'` are treated as the same combo
- **Single emoji**: Use format `'😄|—'` for single emoji detection
- **Default fallback**: Use key `'DEFAULT'` for when no combo matches

Example:
```javascript
const COMBO_PLAYLISTS = {
    '😄|😈': [ /* tracks */ ],
    '😄|—': [ /* single emoji tracks */ ],
    'DEFAULT': [ /* fallback tracks */ ]
};
```

### 4. Replacing the Model

The app uses TensorFlow.js for emoji detection. To use your own model:

#### Option A: Teachable Machine Export

1. Train your model in [Google Teachable Machine](https://teachablemachine.withgoogle.com/)
2. Export as TensorFlow.js model
3. Place files in `emoji-model/`:
   - `model.json`
   - `weights/` folder with weight files

#### Option B: Custom TensorFlow.js Model

1. Export your model in TensorFlow.js format
2. Place in `emoji-model/` folder
3. Update `app.js`:

**Step 1: Update model path** (if different)
```javascript
const CONFIG = {
    MODEL_PATH: './emoji-model/model.json',
    // ...
};
```

**Step 2: Update model adapter** (in `EmojiModelAdapter` class)

Update the `loadModel()` method:
```javascript
async loadModel() {
    this.model = await tf.loadLayersModel(CONFIG.MODEL_PATH);
    this.isLoaded = true;
    // Get input size from model if needed
    const inputShape = this.model.inputs[0].shape;
    this.inputSize = [inputShape[1], inputShape[2]];
    return true;
}
```

**Step 3: Update emoji labels** (in `predict()` method)

Replace the `emojiLabels` array with your model's class labels:
```javascript
const emojiLabels = ['😄', '😈', '🎵', '🔥', '❤️', '⭐']; // Your labels
```

**Step 4: Adjust preprocessing** (if needed)

Modify `preprocess()` method based on your model's requirements:
- Input size (default: 224x224)
- Normalization (default: divide by 255)
- Color channels (default: RGB)

**Step 5: Disable mock mode**

In `app.js`, set:
```javascript
const CONFIG = {
    MOCK_MODE: false, // Enable real detection
    // ...
};
```

#### Model Requirements

- **Format**: TensorFlow.js Layers Model
- **Input**: Image (will be resized to model's input size)
- **Output**: Class probabilities (one per emoji class)
- **Size**: Keep model under 10MB for better loading performance

## Configuration

Edit `CONFIG` object in `app.js`:

```javascript
const CONFIG = {
    CONFIDENCE_THRESHOLD: 0.75,    // Minimum confidence (0-1)
    SMOOTHING_FRAMES: 8,            // Frames for stable detection
    DETECTION_FPS: 10,              // Detection rate (frames per second)
    LOW_POWER_FPS: 5,               // FPS in low power mode
    MODEL_PATH: './emoji-model/model.json',
    MOCK_MODE: true,                // Set to false when model ready
};
```

### Tuning Detection

- **CONFIDENCE_THRESHOLD**: Higher = more strict (fewer false positives, more misses)
- **SMOOTHING_FRAMES**: Higher = more stable but slower to respond
- **DETECTION_FPS**: Higher = more responsive but uses more CPU

## Troubleshooting

### Camera Permissions

**Issue**: Camera doesn't start

**Solutions**:
- Ensure you're using HTTPS (required for camera access)
- Check browser permissions (Settings → Site Settings → Camera)
- On iOS Safari: Tap "Allow" when prompted
- Try refreshing the page

### iOS Autoplay Restrictions

**Issue**: Audio doesn't play automatically

**Solutions**:
- The app requires a user tap to unlock audio (handled by "Tap to Start" button)
- Ensure you tap the start button before expecting audio
- On iOS, audio must be triggered by user interaction

### Detection Not Working

**Issue**: No emojis detected

**Solutions**:
1. **Check model loading**: Open browser console, look for "Model loaded successfully"
2. **Lower confidence threshold**: Try `CONFIDENCE_THRESHOLD: 0.5`
3. **Check lighting**: Ensure cubes are well-lit and clearly visible
4. **Check model labels**: Verify emoji labels in code match your model
5. **Test in mock mode**: Use dropdown to verify playlist switching works

### Model Loading Errors

**Issue**: "Model failed to load" or CORS errors

**Solutions**:
- Ensure model files are in correct location (`emoji-model/`)
- Check file paths are correct (use relative paths)
- For local testing, use a local server (not `file://`)
- For GitHub Pages, ensure all files are committed and pushed

### Audio Not Playing

**Issue**: Tracks don't play or show errors

**Solutions**:
- Check audio file paths in `COMBO_PLAYLISTS`
- Verify files exist in `assets/audio/` folder
- Check browser console for 404 errors
- Ensure audio format is MP3 (most compatible)
- Check file size (very large files may not load)

### Performance Issues

**Issue**: App is slow or laggy

**Solutions**:
- Enable "Low Power Mode" toggle
- Reduce `DETECTION_FPS` in config
- Reduce model size (fewer classes, smaller input)
- Close other browser tabs
- Use a device with better performance

### Mobile Safari Issues

**Issue**: Camera or audio doesn't work on iPhone

**Solutions**:
- Ensure iOS 11+ (required for camera API)
- Use Safari (not Chrome on iOS)
- Check Settings → Safari → Camera/Microphone permissions
- Try closing and reopening Safari
- Restart device if issues persist

## Development

### Local Testing

For local development, use a local server (required for camera API):

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (with http-server)
npx http-server

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### Testing Without Camera

The app includes a mock mode with dropdown controls:
1. Set `MOCK_MODE: true` in config
2. Use dropdowns to simulate emoji detection
3. Test playlist switching and music player

## Browser Compatibility

- ✅ Chrome/Edge (Desktop & Android)
- ✅ Safari (iOS 11+, macOS)
- ✅ Firefox (Desktop)
- ⚠️ Chrome on iOS (limited camera support, use Safari)

## License

This project is provided as-is for educational and personal use.

## Credits

- Built with [TensorFlow.js](https://www.tensorflow.org/js)
- Designed for GitHub Pages deployment
- Mobile-first responsive design
