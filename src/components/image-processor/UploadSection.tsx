import { Upload, ImageIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface UploadSectionProps {
  onUpload: (file: File) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

export const UploadSection = ({
  onUpload,
  onDrop,
}: UploadSectionProps) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <Card className="relative group">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-gray-200 rounded-xl transition-all duration-300 group-hover:border-primary/50 group-hover:bg-gray-50/50"
      >
        <div className="mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors duration-300">
            <ImageIcon className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Upload an Image
          </h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Drag and drop your image here, or click the button below to select from your computer
          </p>
        </div>

        <div className="space-y-4">
          <label className="relative inline-block">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleFileChange}
              accept="image/*"
            />
            <Button className="bg-primary hover:bg-primary/90 text-white relative pointer-events-none">
              <Upload className="w-5 h-5 mr-2" />
              Choose Image
            </Button>
          </label>
          <p className="text-sm text-gray-400">
            Supports: JPG, PNG, WebP
          </p>
        </div>
      </div>
    </Card>
  );
};