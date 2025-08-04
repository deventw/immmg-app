import { useState, useRef, useCallback } from 'react'
import './App.css'

interface ImageData {
  src: string
  width: number
  height: number
  filename: string
}

function App() {
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null)
  const [rotation, setRotation] = useState(0)
  const [sliceAmount, setSliceAmount] = useState(2)
  const [useCustomRatios, setUseCustomRatios] = useState(false)
  const [customWidth, setCustomWidth] = useState<string>('1')
  const [customHeight, setCustomHeight] = useState<string>('1')
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
            height: img.height,
            filename: file.name.replace(/\.[^/.]+$/, '') // Remove file extension
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

  const parseCustomRatio = useCallback((): { width: number; height: number } | null => {
    const width = parseFloat(customWidth)
    const height = parseFloat(customHeight)
    
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      return null
    }
    
    return {
      width,
      height
    }
  }, [customWidth, customHeight])

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

      const images: string[] = []

      if (useCustomRatios) {
        // Use custom ratios
        
        // Parse the custom ratio from width and height inputs
        const ratio = parseCustomRatio()
        
        if (!ratio) {
          // Fallback to equal slices if no valid ratios
          const baseSliceWidth = Math.floor(canvasWidth / sliceAmount)
          const remainingPixels = canvasWidth - (baseSliceWidth * sliceAmount)
          
          for (let i = 0; i < sliceAmount; i++) {
            const sliceCanvas = document.createElement('canvas')
            const sliceCtx = sliceCanvas.getContext('2d')
            if (!sliceCtx) continue

            const actualSliceWidth = baseSliceWidth + (i < remainingPixels ? 1 : 0)
            sliceCanvas.width = actualSliceWidth
            sliceCanvas.height = canvasHeight

            let sourceX = 0
            for (let j = 0; j < i; j++) {
              sourceX += baseSliceWidth + (j < remainingPixels ? 1 : 0)
            }

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
        } else {
          // Use the custom ratio for all slices
          
          // Calculate equal slice width
          const sliceWidth = Math.floor(canvasWidth / sliceAmount)
          const remainingPixels = canvasWidth - (sliceWidth * sliceAmount)
          
          for (let i = 0; i < sliceAmount; i++) {
            const sliceCanvas = document.createElement('canvas')
            const sliceCtx = sliceCanvas.getContext('2d')
            if (!sliceCtx) continue

            // Calculate actual slice width (distribute remaining pixels)
            const actualSliceWidth = sliceWidth + (i < remainingPixels ? 1 : 0)
            
            // Calculate target height based on ratio
            const targetHeight = Math.floor(actualSliceWidth * (ratio.height / ratio.width))
            
            sliceCanvas.width = actualSliceWidth
            sliceCanvas.height = targetHeight

            // Calculate source position
            let sourceX = 0
            for (let j = 0; j < i; j++) {
              sourceX += sliceWidth + (j < remainingPixels ? 1 : 0)
            }

            // Draw the slice with the target aspect ratio
            sliceCtx.drawImage(
              canvas,
              sourceX,
              0,
              actualSliceWidth,
              canvasHeight,
              0,
              0,
              actualSliceWidth,
              targetHeight
            )

            images.push(sliceCanvas.toDataURL('image/png'))
          }
        }
      } else {
        // Use equal slices
        const baseSliceWidth = Math.floor(canvasWidth / sliceAmount)
        const remainingPixels = canvasWidth - (baseSliceWidth * sliceAmount)

        for (let i = 0; i < sliceAmount; i++) {
          const sliceCanvas = document.createElement('canvas')
          const sliceCtx = sliceCanvas.getContext('2d')
          if (!sliceCtx) continue

          const actualSliceWidth = baseSliceWidth + (i < remainingPixels ? 1 : 0)
          
          sliceCanvas.width = actualSliceWidth
          sliceCanvas.height = canvasHeight

          let sourceX = 0
          for (let j = 0; j < i; j++) {
            sourceX += baseSliceWidth + (j < remainingPixels ? 1 : 0)
          }

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
      }

      setCroppedImages(images)
    }
    img.src = selectedImage.src
  }, [selectedImage, rotation, sliceAmount, useCustomRatios, parseCustomRatio])

  const downloadImage = useCallback((dataUrl: string, index: number) => {
    const link = document.createElement('a')
    const filename = selectedImage?.filename || 'image'
    link.download = `${filename}_slice_${index + 1}.png`
    link.href = dataUrl
    link.click()
  }, [selectedImage])

  const downloadAll = useCallback(() => {
    croppedImages.forEach((image, index) => {
      setTimeout(() => {
        downloadImage(image, index)
      }, index * 100)
    })
  }, [croppedImages, downloadImage])

  return (
    <div className="app">
      <h1>圖片裁切器</h1>
      
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
          載入圖片
        </button>
      </div>

      {selectedImage && (
        <div className="controls">
          <div className="control-group">
            <label>旋轉: {rotation}°</label>
            <button onClick={rotateImage}>旋轉 90°</button>
          </div>
          
          <div className="control-group">
            <label>切片數量: {sliceAmount}</label>
            <input
              type="range"
              min="2"
              max="10"
              value={sliceAmount}
              onChange={(e) => setSliceAmount(Number(e.target.value))}
            />
          </div>
          
          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={useCustomRatios}
                onChange={(e) => setUseCustomRatios(e.target.checked)}
              />
              使用自訂比例
            </label>
          </div>
          
                    {useCustomRatios && (
            <div className="ratios-section">
              <label>比例:</label>
              <div className="ratios-inputs">
                <div className="ratio-input-group">
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    placeholder="寬度"
                    className="ratio-input"
                    min="0.1"
                    step="0.1"
                  />
                  <span style={{ color: '#333', fontWeight: 'bold' }}>:</span>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    placeholder="高度"
                    className="ratio-input"
                    min="0.1"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          )}
          
          <button onClick={cropImage} className="crop-btn">
            裁切圖片
          </button>
        </div>
      )}

      {selectedImage && (
        <div className="preview-section">
          <h3>原始圖片</h3>
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
              alt="原始"
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
            <h3>裁切切片 ({croppedImages.length})</h3>
            <button onClick={downloadAll} className="download-all-btn">
              下載全部
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
                  <img src={image} alt={`切片 ${index + 1}`} />
                  <button 
                    onClick={() => downloadImage(image, index)}
                    className="download-btn"
                  >
                    下載切片 {index + 1}
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
