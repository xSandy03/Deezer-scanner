# Emoji Model Folder

This folder contains your TensorFlow.js model files for emoji detection.

## Required Files

When you export your model (e.g., from Teachable Machine), place these files here:

- `model.json` - Model configuration file
- `weights/` - Folder containing model weight files (usually named like `weights.bin`, `weights1.bin`, etc.)

## Model Export Instructions

### From Google Teachable Machine:

1. Train your image classification model with emoji classes
2. Click "Export Model"
3. Select "TensorFlow.js" format
4. Download the ZIP file
5. Extract and copy:
   - `model.json` → place in this folder
   - `weights.bin` (or similar) → place in `weights/` subfolder

### Expected Structure:

```
emoji-model/
├── model.json
└── weights/
    ├── weights.bin
    └── (other weight files if any)
```

## Model Requirements

- **Input**: RGB image (will be resized to model's input size)
- **Output**: Class probabilities array (one value per emoji class)
- **Format**: TensorFlow.js Layers Model
- **Size**: Recommended under 10MB for faster loading

## Testing

Once files are in place:

1. Update `CONFIG.MOCK_MODE = false` in `app.js`
2. Update emoji labels in `EmojiModelAdapter.predict()` method
3. Test the app - model should load automatically

## Troubleshooting

- **404 errors**: Check file paths are correct
- **CORS errors**: Ensure files are served from same origin (GitHub Pages handles this)
- **Model loading fails**: Check browser console for specific error messages
