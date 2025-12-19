# CUBE AR - WebAR Experience

A mobile-first WebAR application using MindAR (image tracking) and A-Frame. Supports multiple simultaneous image targets with synchronized video and audio playback.

## Features

- **Multi-target tracking**: Supports up to 12 image targets (6 per cube) detected simultaneously
- **Video playback**: Each target displays a unique MP4 animation
- **Audio playback**: Priority-based audio system (last found target wins)
- **Mobile-optimized**: Touch-friendly UI with tap-to-start interaction
- **Modern design**: Strict 3-color system (#A238FF, #000000, #FFFFFF)

## File Structure

```
.
├── index.html          # Main HTML file
├── styles.css          # All styles
├── app.js             # Application logic
├── README.md          # This file
├── targets.mind       # MindAR compiled target file (required)
├── v0.mp4 ... v11.mp4 # Video files for targets 0-11 (required)
└── a0.mp3 ... a11.mp3 # Audio files for targets 0-11 (required)
```

## Prerequisites

- HTTPS hosting (required for camera access)
- Modern browser with WebRTC support
- Camera permissions

## Setup

### 1. Prepare Media Files

#### Videos (v0.mp4 to v11.mp4)
- **Format**: MP4 (H.264 codec recommended)
- **Resolution**: 512x512 to 1024x1024 pixels (square)
- **Duration**: Short loops (2-10 seconds recommended)
- **File size**: Keep under 5MB per video for mobile performance
- **Naming**: Must be `v0.mp4`, `v1.mp4`, ... `v11.mp4` in root folder

#### Audio (a0.mp3 to a11.mp3)
- **Format**: MP3 or M4A
- **Duration**: Looping tracks (match video length or longer)
- **Bitrate**: 128kbps recommended
- **File size**: Keep under 2MB per audio file
- **Naming**: Must be `a0.mp3`, `a1.mp3`, ... `a11.mp3` in root folder

### 2. Compile targets.mind

The `targets.mind` file contains compiled image targets for MindAR. To create it:

#### Option A: Using MindAR CLI

1. Install Node.js (v14+)
2. Install MindAR CLI:
   ```bash
   npm install -g @mind-ar/mind-ar-cli
   ```

3. Prepare your target images:
   - Create a folder with 12 images (one per target)
   - Name them: `target0.jpg`, `target1.jpg`, ... `target11.jpg`
   - Recommended: 512x512 to 1024x1024 pixels, high contrast, unique patterns

4. Compile:
   ```bash
   mind-ar-cli compile <path-to-images-folder> --output targets.mind
   ```

#### Option B: Using MindAR Web Compiler

1. Visit: https://mind-ar.github.io/mind-ar-js-doc/tools/compile
2. Upload your 12 target images
3. Download the compiled `.mind` file
4. Rename to `targets.mind` and place in root folder

#### Target Organization
- **Cube A**: targetIndex 0-5 (first 6 images)
- **Cube B**: targetIndex 6-11 (last 6 images)

### 3. Deploy

#### Netlify
1. Push code to GitHub/GitLab
2. Connect repository to Netlify
3. Deploy (HTTPS is automatic)

#### GitHub Pages
1. Push code to GitHub repository
2. Go to Settings > Pages
3. Select branch and folder
4. Enable HTTPS (automatic on GitHub Pages)

#### Local HTTPS Testing
For local development with HTTPS:
```bash
# Using Python
python3 -m http.server 8000 --bind 127.0.0.1

# Then use ngrok or similar
ngrok http 8000
```

## Usage

1. **Open on mobile device** (or desktop with camera)
2. **Grant camera permissions** when prompted
3. **Tap "Tap to Start"** overlay to begin
4. **Point camera at cube targets** (20-40cm distance)
5. **Multiple targets** can be detected simultaneously
6. **Audio plays** for the most recently found target
7. **Use controls**:
   - 🔊 Mute/Unmute audio
   - ? View help
   - D Toggle debug mode

## Troubleshooting

### Autoplay Issues

**Problem**: Videos/audio don't play automatically

**Solutions**:
- Ensure you've tapped "Tap to Start" (required for browser autoplay policies)
- Check that videos have `muted`, `playsinline`, and `loop` attributes
- Verify HTTPS is enabled (required for camera access)
- Test on actual device (not all simulators support camera)

### Tracking Issues

**Problem**: Targets not detected

**Solutions**:
- **Lighting**: Ensure good, even lighting (avoid glare, shadows)
- **Distance**: Hold device 20-40cm from target
- **Stability**: Keep device steady, avoid shaking
- **Target quality**: Use high-contrast, unique patterns on cube faces
- **Angle**: Face camera directly at target, avoid extreme angles
- **Refresh**: Reload page if tracking stops working

### Audio Issues

**Problem**: Audio doesn't play or cuts out

**Solutions**:
- Check mute button state (🔇 = muted)
- Verify audio files are loaded (check Network tab)
- Ensure browser allows audio autoplay (tap-to-start unlocks this)
- Test audio files independently (may be corrupted)
- Check device volume settings

### Performance Issues

**Problem**: Laggy or slow performance

**Solutions**:
- **Reduce video resolution**: Use 512x512 instead of 1024x1024
- **Compress videos**: Use HandBrake or similar (target <2MB per video)
- **Optimize audio**: Use 128kbps MP3, keep files small
- **Limit simultaneous targets**: Fewer targets = better performance
- **Close other apps**: Free up device memory
- **Use modern device**: Older devices may struggle with multiple videos

### Camera Permissions

**Problem**: Camera access denied

**Solutions**:
- Check browser settings for camera permissions
- Ensure HTTPS is enabled (required)
- Try different browser (Chrome, Safari, Firefox)
- Clear browser cache and retry

## Performance Tips

### Video Optimization
- **Resolution**: 512x512 to 1024x1024 (balance quality vs. performance)
- **Codec**: H.264 (widest compatibility)
- **Frame rate**: 24-30fps (no need for 60fps)
- **Duration**: Keep loops short (2-10 seconds)
- **File size**: Target <5MB per video
- **Tools**: Use HandBrake, FFmpeg, or Adobe Media Encoder

### Audio Optimization
- **Format**: MP3 (128kbps) or M4A
- **File size**: Target <2MB per audio
- **Duration**: Match video or create seamless loops
- **Tools**: Use Audacity, iTunes, or online converters

### Target Image Tips
- **High contrast**: Black/white or bright colors
- **Unique patterns**: Avoid repetitive or symmetric designs
- **Size**: 512x512 to 1024x1024 pixels
- **Format**: JPG or PNG
- **Print quality**: Use high-quality printer, avoid glossy paper

## Browser Compatibility

- **Chrome/Edge**: Full support (recommended)
- **Safari (iOS)**: Full support (iOS 11.3+)
- **Firefox**: Full support
- **Opera**: Full support

## Technical Details

### Architecture
- **A-Frame**: 3D framework for WebXR
- **MindAR**: Image tracking library
- **Custom Component**: `target-controller` manages per-target behavior
- **State Management**: Centralized state for detected targets and audio priority

### Audio Priority Logic
- **Single target**: Plays that target's audio
- **Multiple targets**: Plays audio for most recently found target
- **Target lost**: Automatically switches to another detected target's audio
- **All lost**: Stops all audio

### Event Flow
1. MindAR detects target → `targetFound` event
2. Custom component adds target to `detectedTargets` set
3. Video playback starts for that target
4. Audio priority logic evaluates and plays appropriate audio
5. UI updates to show detection status

## License

This project is provided as-is for educational and commercial use.

## Support

For MindAR documentation: https://mind-ar.github.io/mind-ar-js-doc/
For A-Frame documentation: https://aframe.io/docs/
