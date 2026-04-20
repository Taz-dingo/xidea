import { useId, useRef, useState, type ChangeEvent, type ReactElement } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MaterialUploadButton({
  disabled = false,
  label = "上传材料",
  onUpload,
}: {
  disabled?: boolean;
  label?: string;
  onUpload: (file: File) => Promise<void>;
}): ReactElement {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    try {
      await onUpload(file);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "材料上传失败。");
    } finally {
      setIsUploading(false);
      if (inputRef.current !== null) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-2">
      <input
        accept=".txt,.md,.json,.html,.htm,.pdf,.png,.jpg,.jpeg,.gif,.webp,.csv"
        className="sr-only"
        id={inputId}
        onChange={(event) => {
          void handleChange(event);
        }}
        ref={inputRef}
        type="file"
      />
      <Button
        className="rounded-full"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
        type="button"
        variant="outline"
      >
        <Upload className="h-4 w-4" />
        {isUploading ? "上传中..." : label}
      </Button>
      {errorMessage ? (
        <p className="text-[12px] leading-5 text-[#b95e39]">{errorMessage}</p>
      ) : null}
    </div>
  );
}
