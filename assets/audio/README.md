# Audio Files Folder

Place your MP3 audio files in this folder.

## File Requirements

- **Format**: MP3 (most compatible across browsers)
- **Naming**: Use lowercase, hyphens, or underscores (avoid spaces)
  - ✅ Good: `track-a.mp3`, `happy-song.mp3`, `devil_track.mp3`
  - ❌ Bad: `Track A.mp3`, `happy song.mp3`

## Adding Files

1. Place MP3 files in this folder
2. Update `COMBO_PLAYLISTS` in `app.js`:

```javascript
const COMBO_PLAYLISTS = {
    '😄|😈': [
        { 
            title: 'Track Name', 
            artist: 'Artist Name', 
            src: './assets/audio/your-file.mp3'  // Use relative path
        },
    ],
};
```

## File Size Recommendations

- Keep individual files under 5MB for faster loading
- Consider compressing audio if files are large
- Test on mobile devices to ensure smooth playback

## Supported Formats

- **Primary**: MP3 (works everywhere)
- **Alternative**: OGG (better compression, but not supported on iOS Safari)
- **Not recommended**: WAV (too large), M4A (iOS only)

## Testing

After adding files:
1. Verify file paths in `COMBO_PLAYLISTS` match actual filenames
2. Test playback in browser
3. Check browser console for 404 errors if files don't load
