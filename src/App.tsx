import React, { useState, useRef, useCallback } from 'react'
import './App.css'

interface ImageData {
  src: string
  width: number
  height: number
  filename: string
}

interface VideoData {
  src: string
  width: number
  height: number
  filename: string
  duration: number
}

function App() {
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null)
  const [rotation, setRotation] = useState(0)
  const [sliceAmount, setSliceAmount] = useState(3)
  const [croppedImages, setCroppedImages] = useState<string[]>([])
  const [croppedVideos, setCroppedVideos] = useState<string[]>([])
  const [useCustomRatios, setUseCustomRatios] = useState(false)
  const [customWidth, setCustomWidth] = useState('1')
  const [customHeight, setCustomHeight] = useState('1')
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image')
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoFileInputRef = useRef<HTMLInputElement>(null)

  const processVideoSlices = useCallback(async (videoFile: File) => {
    // Create video slices using MediaRecorder with MP4-compatible settings
    const videos: string[] = []
    
    const video = document.createElement('video')
    video.src = URL.createObjectURL(videoFile)
    video.muted = true
    
    video.onloadeddata = async () => {
      // Calculate slice dimensions
      const isVertical = rotation === 90 || rotation === 270
      const videoWidth = isVertical ? video.videoHeight : video.videoWidth
      const videoHeight = isVertical ? video.videoWidth : video.videoHeight
      
      const sliceWidth = Math.floor(videoWidth / sliceAmount)
      
      for (let i = 0; i < sliceAmount; i++) {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        const sourceX = i * sliceWidth
        
        canvas.width = sliceWidth
        canvas.height = videoHeight
        
        // Create MediaRecorder for this slice
        const stream = canvas.captureStream(30) // 30 FPS
        
        // Try to use MP4 format with H.264 codec
        let mimeType = 'video/mp4'
        if (!MediaRecorder.isTypeSupported('video/mp4')) {
          // Fallback to WebM with VP8 codec
          mimeType = 'video/webm;codecs=vp8'
        }
        
        const mediaRecorder = new MediaRecorder(stream, { mimeType })
        
        const chunks: Blob[] = []
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data)
          }
        }
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType })
          const url = URL.createObjectURL(blob)
          videos.push(url)
          
          if (videos.length === sliceAmount) {
            setCroppedVideos(videos)
          }
        }
        
        // Start recording
        mediaRecorder.start()
        
        // Play video and capture frames
        video.currentTime = 0
        video.play()
        
        const captureFrame = () => {
          if (video.ended || video.paused) {
            mediaRecorder.stop()
            return
          }
          
          // Draw the video slice frame
          ctx.drawImage(
            video,
            sourceX,
            0,
            sliceWidth,
            videoHeight,
            0,
            0,
            sliceWidth,
            videoHeight
          )
          
          requestAnimationFrame(captureFrame)
        }
        
        captureFrame()
      }
    }
  }, [selectedVideo, rotation, sliceAmount])

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

  const handleVideoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const video = document.createElement('video')
      video.onloadedmetadata = () => {
        setSelectedVideo({
          src: URL.createObjectURL(file),
          width: video.videoWidth,
          height: video.videoHeight,
          filename: file.name.replace(/\.[^/.]+$/, ''),
          duration: video.duration
        })
        setCroppedVideos([])
      }
      video.src = URL.createObjectURL(file)
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

  const cropImage = useCallback(async () => {
    if (activeTab === 'image' && selectedImage) {
      if (!canvasRef.current) return

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
    } else if (activeTab === 'video' && selectedVideo) {
      // Video cropping logic - use FFmpeg for proper video processing
      const videoFile = await fetch(selectedVideo.src).then(r => r.blob())
      const file = new File([videoFile], 'input.mp4', { type: 'video/mp4' })
      await processVideoSlices(file)
    }
  }, [activeTab, selectedImage, selectedVideo, rotation, sliceAmount, useCustomRatios, parseCustomRatio, processVideoSlices])

  const downloadImage = useCallback((dataUrl: string, index: number) => {
    const link = document.createElement('a')
    const filename = selectedImage?.filename || 'image'
    link.download = `${filename}_slice_${index + 1}.png`
    link.href = dataUrl
    link.click()
  }, [selectedImage])

  const downloadVideo = useCallback((dataUrl: string, index: number) => {
    const link = document.createElement('a')
    const filename = selectedVideo?.filename || 'video'
    // Use MP4 extension for better compatibility
    link.download = `${filename}_slice_${index + 1}.mp4`
    link.href = dataUrl
    link.click()
  }, [selectedVideo])

  const downloadAllVideos = useCallback(() => {
    croppedVideos.forEach((video, index) => {
      setTimeout(() => {
        downloadVideo(video, index)
      }, index * 100)
    })
  }, [croppedVideos, downloadVideo])

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
      
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'image' ? 'active' : ''}`}
          onClick={() => setActiveTab('image')}
        >
          圖片
        </button>
        <button 
          className={`tab ${activeTab === 'video' ? 'active' : ''}`}
          onClick={() => setActiveTab('video')}
        >
          影片
        </button>
      </div>

      {activeTab === 'image' && (
        <div className="tab-content">
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
        </div>
      )}

      {activeTab === 'video' && (
        <div className="tab-content">
          <div className="upload-section">
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              style={{ display: 'none' }}
            />
            <button 
              className="upload-btn"
              onClick={() => videoFileInputRef.current?.click()}
            >
              載入影片
            </button>
          </div>

          {selectedVideo && (
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
                裁切影片
              </button>
            </div>
          )}

          {selectedVideo && (
            <div className="preview-section">
              <h3>原始影片</h3>
              <div className="video-container">
                <video
                  src={selectedVideo.src}
                  controls
                  style={{
                    maxWidth: '100%',
                    height: 'auto'
                  }}
                />
              </div>
            </div>
          )}

          {croppedVideos.length > 0 && (
            <div className="results-section">
              <div className="results-header">
                <h3>裁切影片切片 ({croppedVideos.length})</h3>
                <button onClick={downloadAllVideos} className="download-all-btn">
                  下載全部
                </button>
              </div>
              <div className="slices-container">
                <div className="slices-row">
                  {croppedVideos.map((video, index) => (
                    <div key={index} className="slice-item">
                      <video
                        src={video}
                        controls
                        style={{
                          maxWidth: '100%',
                          height: 'auto'
                        }}
                      />
                      <button 
                        onClick={() => downloadVideo(video, index)}
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
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}

export default App
