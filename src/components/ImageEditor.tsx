import React, { useState, useRef, useEffect, useCallback } from 'react';
import { fabric } from 'fabric';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Crop, Undo2, Redo2, RotateCw, FlipHorizontal, FlipVertical,
  Square, Circle, Triangle, Type, Image as ImageIcon, Sliders,
  PenTool, Minus, Download, ArrowLeft, Loader2, Settings,
  ZoomIn, ZoomOut, Move, Trash2, Save
} from 'lucide-react';
import { toast } from 'sonner';

const useBackgroundRemovalWorker = () => {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const workerCode = `
      self.onmessage = async function(e) {
        const { imageData, threshold } = e.data;
        
        const removeBackground = (imageData, threshold) => {
          const data = imageData.data;
          const width = imageData.width;
          const height = imageData.height;
          
          const luminance = new Uint8Array(width * height);
          const edges = new Uint8Array(width * height);
          
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const i = (y * width + x) * 4;
              luminance[y * width + x] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
              
              if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                const gx = 
                  luminance[(y - 1) * width + (x - 1)] * -1 +
                  luminance[(y - 1) * width + (x + 1)] +
                  luminance[y * width + (x - 1)] * -2 +
                  luminance[y * width + (x + 1)] * 2 +
                  luminance[(y + 1) * width + (x - 1)] * -1 +
                  luminance[(y + 1) * width + (x + 1)];
                
                const gy = 
                  luminance[(y - 1) * width + (x - 1)] * -1 +
                  luminance[(y - 1) * width + x] * -2 +
                  luminance[(y - 1) * width + (x + 1)] * -1 +
                  luminance[(y + 1) * width + (x - 1)] +
                  luminance[(y + 1) * width + x] * 2 +
                  luminance[(y + 1) * width + (x + 1)];
                
                edges[y * width + x] = Math.sqrt(gx * gx + gy * gy) > threshold ? 1 : 0;
              }
            }
          }
          
          const queue = new Uint32Array(width * height);
          let queueStart = 0;
          let queueEnd = 0;
          
          for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
              if (edges[y * width + x]) {
                queue[queueEnd++] = y * width + x;
              }
            }
          }
          
          const visited = new Uint8Array(width * height);
          const chunkSize = 1000;
          
          while (queueStart < queueEnd) {
            const processEnd = Math.min(queueStart + chunkSize, queueEnd);
            
            for (let i = queueStart; i < processEnd; i++) {
              const pos = queue[i];
              const x = pos % width;
              const y = Math.floor(pos / width);
              
              if (!visited[pos]) {
                visited[pos] = 1;
                const idx = pos * 4;
                
                const isBackground = 
                  data[idx] > 240 && 
                  data[idx + 1] > 240 && 
                  data[idx + 2] > 240;
                
                if (isBackground) {
                  data[idx + 3] = 0;
                }
                
                const neighbors = [
                  pos - width, 
                  pos + width, 
                  pos - 1,    
                  pos + 1     
                ];
                
                for (const neighbor of neighbors) {
                  const nx = neighbor % width;
                  const ny = Math.floor(neighbor / width);
                  
                  if (
                    nx >= 0 && nx < width &&
                    ny >= 0 && ny < height &&
                    !visited[neighbor]
                  ) {
                    queue[queueEnd++] = neighbor;
                  }
                }
              }
            }
            
            queueStart = processEnd;
            
            if (queueStart < queueEnd) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
          
          return imageData;
        };

        const processedImageData = await removeBackground(imageData, threshold || 30);
        self.postMessage({ processedImageData });
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    workerRef.current = new Worker(URL.createObjectURL(blob));

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  return workerRef;
};

interface ImageEditorProps {
  initialImage?: string;
  onSave?: (editedImage: string) => void;
  onBack?: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ initialImage, onSave, onBack }) => {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const workerRef = useBackgroundRemovalWorker();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('draw');
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [zoom, setZoom] = useState(100);
  const [threshold, setThreshold] = useState(30);

  useEffect(() => {
    const canvas = new fabric.Canvas('canvas', {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
      enableRetinaScaling: false,
      renderOnAddRemove: false,
      stateful: false,
      selection: true,
      preserveObjectStacking: true
    });

    canvasRef.current = canvas;

    if (initialImage) {
      fabric.Image.fromURL(initialImage, 
        (img) => {
          img.scaleToWidth(canvas.width);
          canvas.add(img);
          canvas.renderAll();
          saveState();
        }, 
        { 
          crossOrigin: 'anonymous',
          objectCaching: true
        }
      );
    }

    return () => {
      canvas.dispose();
    };
  }, [initialImage]);

  const removeBackground = useCallback(async () => {
    if (!canvasRef.current || isProcessing || !workerRef.current) return;
    
    try {
      setIsProcessing(true);
      toast.info('Processing image...');

      const canvas = canvasRef.current.toCanvas();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const chunkSize = Math.min(500, height);
      let processedHeight = 0;

      while (processedHeight < height) {
        const currentHeight = Math.min(chunkSize, height - processedHeight);
        const imageData = ctx.getImageData(0, processedHeight, width, currentHeight);
        
        await new Promise<void>((resolve) => {
          const handler = (e: MessageEvent) => {
            const { processedImageData } = e.data;
            ctx.putImageData(processedImageData, 0, processedHeight);
            workerRef.current?.removeEventListener('message', handler);
            resolve();
          };
          workerRef.current?.addEventListener('message', handler);
          workerRef.current?.postMessage({ imageData, threshold });
        });

        processedHeight += currentHeight;
        const progress = Math.round((processedHeight / height) * 100);
        toast.info(`Processing: ${progress}%`);
      }

      const finalImage = await createImageBitmap(canvas);
      canvasRef.current.clear();
      const fabricImage = new fabric.Image(finalImage);
      canvasRef.current.add(fabricImage);
      canvasRef.current.renderAll();
      saveState();
      toast.success('Background removed successfully!');
    } catch (error) {
      console.error('Background removal error:', error);
      toast.error('Failed to remove background');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, threshold]);

  const saveState = () => {
    if (!canvasRef.current) return;
    const json = JSON.stringify(canvasRef.current.toJSON());
    setUndoStack(prev => [...prev, json]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const currentState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, currentState]);
    setUndoStack(prev => prev.slice(0, -1));
    loadState(currentState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, nextState]);
    setRedoStack(prev => prev.slice(0, -1));
    loadState(nextState);
  };

  const loadState = (state: string) => {
    if (!canvasRef.current) return;
    canvasRef.current.loadFromJSON(JSON.parse(state), () => {
      canvasRef.current!.renderAll();
    });
  };

  const handleDraw = (mode: 'pencil' | 'line') => {
    if (!canvasRef.current) return;
    canvasRef.current.isDrawingMode = mode === 'pencil';
    if (mode === 'pencil') {
      canvasRef.current.freeDrawingBrush.width = brushSize;
      canvasRef.current.freeDrawingBrush.color = brushColor;
    }
  };

  const addShape = (type: 'rect' | 'circle' | 'triangle') => {
    if (!canvasRef.current) return;
    let shape: fabric.Object;

    switch (type) {
      case 'rect':
        shape = new fabric.Rect({
          left: 100,
          top: 100,
          width: 100,
          height: 100,
          fill: brushColor
        });
        break;
      case 'circle':
        shape = new fabric.Circle({
          left: 100,
          top: 100,
          radius: 50,
          fill: brushColor
        });
        break;
      case 'triangle':
        shape = new fabric.Triangle({
          left: 100,
          top: 100,
          width: 100,
          height: 100,
          fill: brushColor
        });
        break;
      default:
        return;
    }

    canvasRef.current.add(shape);
    canvasRef.current.setActiveObject(shape);
    canvasRef.current.renderAll();
    saveState();
  };

  const addText = () => {
    if (!canvasRef.current) return;
    const text = new fabric.IText('Double click to edit', {
      left: 100,
      top: 100,
      fontSize: 20,
      fill: brushColor
    });
    canvasRef.current.add(text);
    canvasRef.current.setActiveObject(text);
    canvasRef.current.renderAll();
    saveState();
  };

  const handleRotate = (angle: number) => {
    if (!canvasRef.current) return;
    const activeObject = canvasRef.current.getActiveObject();
    if (activeObject) {
      activeObject.rotate((activeObject.angle || 0) + angle);
    } else {
      canvasRef.current.getObjects().forEach((obj) => {
        obj.rotate((obj.angle || 0) + angle);
      });
    }
    canvasRef.current.renderAll();
    saveState();
  };

  const handleFlip = (direction: 'horizontal' | 'vertical') => {
    if (!canvasRef.current) return;
    const activeObject = canvasRef.current.getActiveObject();
    if (activeObject) {
      if (direction === 'horizontal') {
        activeObject.flipX = !activeObject.flipX;
      } else {
        activeObject.flipY = !activeObject.flipY;
      }
    } else {
      canvasRef.current.getObjects().forEach((obj) => {
        if (direction === 'horizontal') {
          obj.flipX = !obj.flipX;
        } else {
          obj.flipY = !obj.flipY;
        }
      });
    }
    canvasRef.current.renderAll();
    saveState();
  };

  const handleFilter = () => {
    if (!canvasRef.current) return;
    const objects = canvasRef.current.getObjects();
    objects.forEach((obj) => {
      if (obj instanceof fabric.Image) {
        obj.filters = [
          new fabric.Image.filters.Brightness({ brightness: (brightness - 100) / 100 }),
          new fabric.Image.filters.Contrast({ contrast: (contrast - 100) / 100 })
        ];
        obj.applyFilters();
      }
    });
    canvasRef.current.renderAll();
    saveState();
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL();
    onSave?.(dataUrl);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-white">Professional Image Editor</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-lg">
            <ZoomOut className="w-4 h-4 text-gray-400" />
            <Slider
              value={[zoom]}
              min={50}
              max={200}
              step={1}
              className="w-24"
              onValueChange={(value) => setZoom(value[0])}
            />
            <ZoomIn className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300 ml-2">{zoom}%</span>
          </div>
          <Button 
            variant="ghost"
            onClick={removeBackground}
            disabled={isProcessing}
            className="hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Settings className="w-4 h-4 mr-2" />
                Remove Background
              </>
            )}
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleUndo}
            className="hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleRedo}
            className="hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            onClick={handleSave}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Image
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-gray-900">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative group">
            <canvas 
              id="canvas" 
              className="rounded-lg shadow-2xl transform transition-transform duration-200" 
              style={{ 
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center center'
              }} 
            />
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg backdrop-blur-sm">
                <div className="text-center text-white">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Processing Image...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-700 bg-gray-800">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex justify-center space-x-2 mb-4 bg-gray-900 p-1 rounded-lg">
            <TabsTrigger 
              value="draw" 
              className="flex items-center px-4 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              <PenTool className="w-4 h-4 mr-2" />
              Draw
            </TabsTrigger>
            <TabsTrigger 
              value="shape"
              className="flex items-center px-4 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              <Square className="w-4 h-4 mr-2" />
              Shape
            </TabsTrigger>
            <TabsTrigger 
              value="text"
              className="flex items-center px-4 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              <Type className="w-4 h-4 mr-2" />
              Text
            </TabsTrigger>
            <TabsTrigger 
              value="transform"
              className="flex items-center px-4 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Transform
            </TabsTrigger>
            <TabsTrigger 
              value="filter"
              className="flex items-center px-4 py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
            >
              <Sliders className="w-4 h-4 mr-2" />
              Filter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-4">
            <div className="flex gap-4 bg-gray-900 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Brush Size</label>
                <Input
                  type="number"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-20 bg-gray-700 border-gray-800 text-white"
                  min={1}
                  max={50}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Color</label>
                <Input
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                  className="w-12 h-9 p-1 bg-gray-700 border-gray-800"
                />
              </div>
              <Button 
                onClick={() => handleDraw('pencil')}
                className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
              >
                <PenTool className="w-4 h-4 mr-2" />
                Free Draw
              </Button>
              <Button 
                onClick={() => handleDraw('line')}
                className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
              >
                <Minus className="w-4 h-4 mr-2" />
                Line
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="shape" className="space-y-4">
            <div className="flex gap-4 bg-gray-900 p-4 rounded-lg">
              <Button 
                onClick={() => addShape('rect')}
                className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
              >
                <Square className="w-4 h-4 mr-2" />
                Rectangle
              </Button>
              <Button 
                onClick={() => addShape('circle')}
                className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
              >
                <Circle className="w-4 h-4 mr-2" />
                Circle
              </Button>
              <Button 
                onClick={() => addShape('triangle')}
                className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
              >
                <Triangle className="w-4 h-4 mr-2" />
                Triangle
              </Button>
              <Input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-12 h-9 p-1 bg-gray-700 border-gray-800"
              />
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div className="bg-gray-900 p-4 rounded-lg">
              <Button 
                onClick={addText}
                className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
              >
                <Type className="w-4 h-4 mr-2" />
                Add Text
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="transform" className="space-y-4">
            <div className="flex gap-4 bg-gray-900 p-4 rounded-lg">
              <Button 
                onClick={() => handleRotate(90)}
                className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Rotate 90°
              </Button>
              <Button 
                onClick={() => handleRotate(-90)}
                className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Rotate -90°
              </Button>
              <Button 
                onClick={() => handleFlip('horizontal')}
                className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
              >
                <FlipHorizontal className="w-4 h-4 mr-2" />
                Flip H
              </Button>
              <Button 
                onClick={() => handleFlip('vertical')}
                className="bg-gray-700 hover:bg-gray-800 text-white transition-colors"
              >
                <FlipVertical className="w-4 h-4 mr-2" />
                Flip V
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="filter" className="space-y-4">
            <div className="bg-gray-900 p-4 rounded-lg space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Brightness</label>
                <Slider
                  value={[brightness]}
                  min={0}
                  max={200}
                  step={1}
                  onValueChange={(value) => setBrightness(value[0])}
                  className="py-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Contrast</label>
                <Slider
                  value={[contrast]}
                  min={0}
                  max={200}
                  step={1}
                  onValueChange={(value) => setContrast(value[0])}
                  className="py-2"
                />
              </div>
              <Button 
                onClick={handleFilter}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Apply Filters
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ImageEditor;
