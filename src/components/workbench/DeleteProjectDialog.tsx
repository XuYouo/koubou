import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectSummary } from "@/lib/types";

type DeleteProjectDialogProps = {
  project: ProjectSummary | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteProjectDialog({
  project,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteProjectDialogProps) {
  const projectName = project?.name ? `"${project.name}"` : "this project";
  const description = `This will permanently delete ${projectName}, including its saved canvas, assets, and generation history.`;

  return (
    <Dialog
      open={Boolean(project)}
      onOpenChange={(open) => {
        if (!open && !isDeleting) {
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogTitle>Delete project?</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
