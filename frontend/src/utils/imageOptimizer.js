/**
 * Image optimization utility for rural mobile devices and low-bandwidth connections.
 * Downscales camera photos (often 8MB-15MB from modern smartphone cameras) to a
 * web-optimized JPEG (~150KB-350KB, max 1280x1280) before upload.
 */

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/gif',
])

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'])

export function isImageFile(file) {
  if (!file) return false
  if (file.type && ALLOWED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) return true
  const ext = (file.name || '').split('.').pop()?.toLowerCase()
  return ext ? ALLOWED_EXTENSIONS.has(ext) : false
}

/**
 * Compresses and scales down an image file using an HTML5 Canvas.
 *
 * @param {File} file - Original image file from file picker or camera.
 * @param {Object} options
 * @param {number} [options.maxWidth=1280] - Maximum width in pixels.
 * @param {number} [options.maxHeight=1280] - Maximum height in pixels.
 * @param {number} [options.quality=0.8] - JPEG quality (0.0 to 1.0).
 * @returns {Promise<File>} Compressed File instance.
 */
export async function compressCropImage(file, options = {}) {
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.8 } = options

  if (!file) {
    throw new Error('NO_FILE')
  }

  if (!isImageFile(file)) {
    const error = new Error('INVALID_FORMAT')
    error.code = 'INVALID_FORMAT'
    throw error
  }

  // If already small (< 120KB) or an animated GIF / SVG, skip re-encoding to avoid quality loss
  if (file.size < 120 * 1024 || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file
  }

  // If running in an environment without DOM canvas, fallback gracefully
  if (typeof window === 'undefined' || !window.HTMLCanvasElement) {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onerror = () => {
      // Graceful fallback to original file on read error
      resolve(file)
    }

    reader.onload = (e) => {
      const img = new Image()

      img.onerror = () => {
        // Fallback to original file if image decoding fails
        resolve(file)
      }

      img.onload = () => {
        try {
          let { width, height } = img

          if (!width || !height) {
            resolve(file)
            return
          }

          // Calculate aspect-ratio-preserving dimensions
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(file)
            return
          }

          // White background for PNG transparency conversion to JPEG
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file)
                return
              }

              // Create a clean JPEG filename
              const baseName = (file.name || 'crop_image').replace(/\.[^/.]+$/, '')
              const compressedFile = new File([blob], `${baseName}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })

              // If compressed file is somehow larger than original, return original
              if (compressedFile.size > file.size) {
                resolve(file)
              } else {
                resolve(compressedFile)
              }
            },
            'image/jpeg',
            quality
          )
        } catch {
          // Fallback to original file on unexpected canvas errors
          resolve(file)
        }
      }

      img.src = e.target.result
    }

    reader.readAsDataURL(file)
  })
}
