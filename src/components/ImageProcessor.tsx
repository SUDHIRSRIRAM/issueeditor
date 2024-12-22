import { useState } from "react";
import { useToast } from "./ui/use-toast";
import { removeBackground } from "@imgly/background-removal";
import { UploadSection } from "./image-processor/UploadSection";
import { ResultSection } from "./image-processor/ResultSection";
import { ImageEditor } from "./image-processor/ImageEditor";
import { Card, CardContent } from "./ui/card";

export const ImageProcessor = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setOriginalImage(e.target.result as string);
        setProcessedImage(null);
        setIsEditing(false);
        toast({
          title: "Success",
          description: "Image uploaded successfully",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const handleDelete = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setProgress(0);
    setIsEditing(false);
    toast({
      title: "Deleted",
      description: "Image has been removed",
    });
  };

  const processImage = async () => {
    if (!originalImage) return;

    try {
      setIsProcessing(true);
      setProgress(0);

      const response = await fetch(originalImage);
      const blob = await response.blob();

      const result = await removeBackground(blob, {
        progress: (args_0: string, args_1: number) => {
          setProgress(Math.round(args_1 * 100));
        },
        model: "medium"
      });

      const processedImageUrl = URL.createObjectURL(result);
      setProcessedImage(processedImageUrl);
      toast({
        title: "Success!",
        description: "Background removed successfully",
      });
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "Error",
        description: "Failed to process image",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;
    const link = document.createElement("a");
    link.href = processedImage;
    link.download = "processed-image.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Downloaded",
      description: "Image has been saved",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Background Remover
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Remove backgrounds from your images with AI-powered precision
          </p>
        </div>

        <Card className="bg-white shadow-xl rounded-xl overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            {!originalImage && (
              <UploadSection onDrop={handleDrop} onUpload={handleImageUpload} />
            )}

            {originalImage && !isEditing && (
              <ResultSection
                originalImage={originalImage}
                processedImage={processedImage}
                isProcessing={isProcessing}
                progress={progress}
                onProcess={processImage}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onEdit={() => setIsEditing(true)}
                setIsEditing={setIsEditing}
              />
            )}

            {processedImage && isEditing && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    Edit Image
                  </h2>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      Download
                    </button>
                  </div>
                </div>
                
                <ImageEditor
                  processedImage={processedImage}
                  onImageUpdate={setProcessedImage}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};