import { Trash2 } from "lucide-react";

import type {
  ProjectContextMenuState,
} from "@/hooks/useProjectWorkspace";
import type { ProjectSummary } from "@/lib/types";

type ProjectActionMenuProps = {
  menu: ProjectContextMenuState | null;
  onRequestDelete: (project: ProjectSummary) => void;
};

export function ProjectActionMenu({
  menu,
  onRequestDelete,
}: ProjectActionMenuProps) {
  if (!menu) return null;

  return (
    <div
      role="menu"
      aria-label={`Project actions for ${menu.project.name}`}
      className="fixed z-40 min-w-44 rounded-md border border-neutral-200 bg-white p-1 shadow-lg"
      style={{
        left: menu.x,
        top: menu.y,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
        onClick={() => onRequestDelete(menu.project)}
      >
        <Trash2 className="h-4 w-4" />
        Delete project
      </button>
    </div>
  );
}
