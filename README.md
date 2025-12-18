# Emoji Recognition Scanner

A minimal, full-screen web application that uses TensorFlow.js and Teachable Machine to recognize custom emoji images from your device camera and automatically redirects when a match is detected.

## Features

- 🎥 **Full-screen camera preview** with centered ROI (Region of Interest) overlay
- 🤖 **Real-time emoji recognition** using Teachable Machine models
- 🔄 **Automatic redirect** when conditions are met (confidence ≥ 0.85 + 8 consecutive frames)
- 🚀 **Auto-start** - camera starts automatically on page load
- 📱 **Minimal UI** - clean, distraction-free scanning interface
- 🔒 **Redirect loop prevention** using sessionStorage

## Quick Start

### 1. Place Your Model Files

Create a `model` folder and place your Teachable Machine model files:

```
/model/
  ├── model.json
  ├── metadata.json
  └── weights.bin (or weights_*.shard files)
```

**Important:** The model files must be accessible at `/model/model.json`, `/model/metadata.json`, etc.

### 2. Configure Redirect URLs

Edit `app.js` and update the `REDIRECTS` object with your emoji labels and target URLs:

```javascript
const REDIRECTS = {
    "emoji_fire": "https://example.com/fire",
    "emoji_heart": "https://example.com/heart",
    "emoji_check": "https://example.com/check"
};
```

### 3. Deploy to GitHub Pages

1. Push your code to a GitHub repository
2. Go to **Settings** → **Pages**
3. Select your branch (usually `main` or `master`)
4. Click **Save**
5. Your site will be available at `https://yourusername.github.io/repository-name/`

**Note:** GitHub Pages provides HTTPS automatically, which is required for camera access.

### 4. Run Locally (Development)

The camera API requires HTTPS or localhost. Choose one of these methods:

#### Option A: Using npx serve (Node.js)

```bash
npx serve .
```

Then open `http://localhost:3000` in your browser.

#### Option B: Using Python

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then open `http://localhost:8000` in your browser.

## Usage

1. **Open the page** - The camera will automatically request permission
2. **Position your emoji** - Hold your custom emoji image inside the green centered box
3. **Wait for redirect** - When a match is detected (confidence ≥ 0.85 for 8 consecutive frames), the page will automatically redirect

## Configuration

You can adjust the detection settings in `app.js`:

```javascript
const CONFIDENCE_THRESHOLD = 0.85;        // Minimum confidence (0.0 - 1.0)
const REQUIRED_CONSECUTIVE_FRAMES = 8;    // Number of consecutive matches needed
const INFERENCE_INTERVAL = 100;           // Inference frequency in ms (~10 FPS)
```

## Training Tips for Teachable Machine

When training your model in Teachable Machine:

1. **Include a "none" or "background" class**: This helps the model distinguish between your emojis and empty/background scenes.

2. **Capture diverse examples**:
   - Different lighting conditions
   - Various angles and distances
   - Different backgrounds
   - Multiple instances of each emoji

3. **Use consistent ROI**: Train with images that match the ROI size and position used in the app (centered square, ~40% of frame).

4. **Export as TensorFlow.js**: When exporting from Teachable Machine, choose "TensorFlow.js" format.

5. **Model files**: After export, you'll get:
   - `model.json` - Model architecture
   - `metadata.json` - Class labels and metadata
   - `weights.bin` or `weights_*.shard` - Model weights

## File Structure

```
.
├── index.html      # Main HTML structure
├── styles.css      # Styling
├── app.js          # Application logic
├── README.md       # This file
├── .gitignore      # Git ignore rules
├── .nojekyll       # GitHub Pages config
└── model/          # Your Teachable Machine model files
    ├── model.json
    ├── metadata.json
    └── weights.bin
```

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS 11+)
- Opera: ✅ Full support

## Troubleshooting

### Camera Permission Denied
- Check browser settings and allow camera access
- Ensure you're using HTTPS or localhost (GitHub Pages provides HTTPS automatically)

### Model Not Loading
- Verify all model files are in the `/model/` folder
- Check browser console for specific errors
- Ensure model files are accessible (not blocked by CORS)
- For GitHub Pages, make sure model files are committed to the repository

### No Redirect Happening
- Check that the predicted label matches a key in the `REDIRECTS` object
- Verify confidence threshold is not too high
- Ensure consecutive frames requirement is met
- Check browser console for prediction values

### HTTPS Required
- Camera API requires secure context
- Use localhost for development
- GitHub Pages provides HTTPS automatically for production

## License

This project is provided as-is for educational and development purposes.
