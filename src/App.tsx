import { useState, useRef, useCallback } from 'react'
import './App.css'

interface ImageData {
  src: string
  width: number
  height: number
}

function App() {
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null)
  const [rotation, setRotation] = useState(0)
  const [sliceAmount, setSliceAmount] = useState(2)
  const [croppedImages, setCroppedImages] = useState<string[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          setSelectedImage({
            src: e.target?.result as string,
            width: img.width,
            height: img.height
          })
          setCroppedImages([])
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const rotateImage = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  const cropImage = useCallback(() => {
    if (!selectedImage || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      // Calculate dimensions after rotation
      const isVertical = rotation === 90 || rotation === 270
      const canvasWidth = isVertical ? img.height : img.width
      const canvasHeight = isVertical ? img.width : img.height

      canvas.width = canvasWidth
      canvas.height = canvasHeight

      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // Save context, rotate, draw, restore
      ctx.save()
      ctx.translate(canvasWidth / 2, canvasHeight / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()

      // Calculate slice width to use all pixels
      const baseSliceWidth = Math.floor(canvasWidth / sliceAmount)
      const remainingPixels = canvasWidth - (baseSliceWidth * sliceAmount)
      const images: string[] = []

      // Create slices
      for (let i = 0; i < sliceAmount; i++) {
        const sliceCanvas = document.createElement('canvas')
        const sliceCtx = sliceCanvas.getContext('2d')
        if (!sliceCtx) continue

        // Calculate actual slice width (distribute remaining pixels to first slices)
        const actualSliceWidth = baseSliceWidth + (i < remainingPixels ? 1 : 0)
        
        sliceCanvas.width = actualSliceWidth
        sliceCanvas.height = canvasHeight

        // Calculate source position
        let sourceX = 0
        for (let j = 0; j < i; j++) {
          sourceX += baseSliceWidth + (j < remainingPixels ? 1 : 0)
        }

        // Draw the slice
        sliceCtx.drawImage(
          canvas,
          sourceX,
          0,
          actualSliceWidth,
          canvasHeight,
          0,
          0,
          actualSliceWidth,
          canvasHeight
        )

        images.push(sliceCanvas.toDataURL('image/png'))
      }

      setCroppedImages(images)
    }
    img.src = selectedImage.src
  }, [selectedImage, rotation, sliceAmount])

  const downloadImage = useCallback((dataUrl: string, index: number) => {
    const link = document.createElement('a')
    link.download = `slice_${index + 1}.png`
    link.href = dataUrl
    link.click()
  }, [])

  const downloadAll = useCallback(() => {
    croppedImages.forEach((image, index) => {
      setTimeout(() => {
        downloadImage(image, index)
      }, index * 100)
    })
  }, [croppedImages, downloadImage])

  return (
    <div className="app">
      <h1>Image Cropper</h1>
      
      <div className="upload-section">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
        <button 
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          Load Image
        </button>
      </div>

      {selectedImage && (
        <div className="controls">
          <div className="control-group">
            <label>Rotation: {rotation}°</label>
            <button onClick={rotateImage}>Rotate 90°</button>
          </div>
          
          <div className="control-group">
            <label>Slice Amount: {sliceAmount}</label>
            <input
              type="range"
              min="2"
              max="10"
              value={sliceAmount}
              onChange={(e) => setSliceAmount(Number(e.target.value))}
            />
          </div>
          
          <button onClick={cropImage} className="crop-btn">
            Crop Image
          </button>
        </div>
      )}

      {selectedImage && (
        <div className="preview-section">
          <h3>Original Image</h3>
          <div 
            className="image-container"
            style={{
              aspectRatio: rotation === 90 || rotation === 270 
                ? `${selectedImage.height / selectedImage.width}` 
                : `${selectedImage.width / selectedImage.height}`,
              maxWidth: rotation === 90 || rotation === 270 ? '60vh' : '100%',
              maxHeight: rotation === 90 || rotation === 270 ? '100%' : '60vh'
            }}
          >
            <img
              src={selectedImage.src}
              alt="Original"
              style={{
                transform: `rotate(${rotation}deg)`,
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
      )}

      {croppedImages.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h3>Cropped Slices ({croppedImages.length})</h3>
            <button onClick={downloadAll} className="download-all-btn">
              Download All
            </button>
          </div>
          <div className="slices-container">
            <div 
              className="slices-row"
              style={{
                maxWidth: '100%',
                maxHeight: '40vh',
                minHeight: '200px'
              }}
            >
              {croppedImages.map((image, index) => (
                <div key={index} className="slice-item">
                  <img src={image} alt={`Slice ${index + 1}`} />
                  <button 
                    onClick={() => downloadImage(image, index)}
                    className="download-btn"
                  >
                    Download Slice {index + 1}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}

export default App
