import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Trash2, Download, Wand2 } from "lucide-react";
import { Card } from "../ui/card";

interface ResultSectionProps {
  originalImage: string;
  processedImage: string | null;
  isProcessing: boolean;
  progress: number;
  onProcess: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onEdit: () => void;
  setIsEditing: (isEditing: boolean) => void;
}

export const ResultSection = ({
  originalImage,
  processedImage,
  isProcessing,
  progress,
  onProcess,
  onDelete,
  onDownload,
  onEdit,
  setIsEditing,
}: ResultSectionProps) => {
  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Original Image */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Original Image</h3>
          </div>
          <div className="p-6">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
              <img
                src={originalImage}
                alt="Original"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        </Card>

        {/* Processed Image */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Processed Image</h3>
          </div>
          <div className="p-6">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
              {processedImage ? (
                <img
                  src={processedImage}
                  alt="Processed"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-center text-gray-500 p-4">
                  <Wand2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Click "Remove Background" to process the image</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Button
          onClick={onProcess}
          disabled={isProcessing}
          className="bg-primary hover:bg-primary/90 text-white min-w-[200px] h-12"
        >
          {isProcessing ? (
            <div className="w-full space-y-2">
              <span>Processing... {progress}%</span>
              <Progress value={progress} className="w-full h-1" />
            </div>
          ) : (
            <>
              <Wand2 className="w-5 h-5 mr-2" />
              Remove Background
            </>
          )}
        </Button>

        <Button
          variant="destructive"
          onClick={onDelete}
          className="min-w-[200px] h-12"
        >
          <Trash2 className="w-5 h-5 mr-2" />
          Delete
        </Button>

        <Button
          onClick={() => {
            onEdit();
            setIsEditing(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px] h-12"
        >
          <Wand2 className="w-5 h-5 mr-2" />
          Edit Image
        </Button>

        {processedImage && (
          <Button
            onClick={onDownload}
            className="bg-green-600 hover:bg-green-700 text-white min-w-[200px] h-12"
          >
            <Download className="w-5 h-5 mr-2" />
            Download
          </Button>
        )}
      </div>
    </div>
  );
};