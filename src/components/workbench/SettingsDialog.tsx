"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  KeyRound,
  LogOut,
  Settings,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_IMAGE_SETTINGS,
  IMAGE_OUTPUT_FORMATS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  type ImageSettings,
} from "@/lib/image-options";
import type { SafeUser } from "@/lib/types";

type AdminUser = {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
};

type UsageRow = {
  userId: string;
  username: string;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "DISABLED";
  requests: number;
  succeeded: number;
  failed: number;
  generatedImages: number;
  lastUsedAt: string | null;
};

type ModelConfigView = {
  id: string;
  provider: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
  hasApiKey: boolean;
  defaultOptions: ImageSettings;
  updatedAt: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SafeUser;
  settings: ImageSettings;
  onSettingsChange: (settings: ImageSettings) => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onLogout: () => void;
};

const navItems = [
  { id: "workspace", label: "Workspace", icon: Settings, admin: false },
  { id: "users", label: "Users", icon: Users, admin: true },
  { id: "usage", label: "Usage", icon: BarChart3, admin: true },
  { id: "model", label: "Model API", icon: KeyRound, admin: true },
] as const;

export function SettingsDialog({
  open,
  onOpenChange,
  user,
  settings,
  onSettingsChange,
  projectName,
  onProjectNameChange,
  onLogout,
}: Props) {
  const visibleNav = useMemo(
    () => navItems.filter((item) => !item.admin || user.role === "ADMIN"),
    [user.role]
  );
  const [activeTab, setActiveTab] = useState<(typeof navItems)[number]["id"]>(
    "workspace"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 md:max-w-[860px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage workspace and admin settings.
        </DialogDescription>
        <div className="grid h-[640px] grid-cols-[190px_1fr] bg-white">
          <aside className="border-r border-neutral-200 bg-neutral-50 p-3">
            <div className="mb-4 px-2 py-1">
              <p className="text-sm font-medium text-neutral-950">
                {user.username}
              </p>
              <p className="text-xs text-neutral-500">{user.role}</p>
            </div>
            <nav className="space-y-1">
              {visibleNav.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm ${
                    activeTab === item.id
                      ? "bg-neutral-950 text-white"
                      : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </nav>
            <Button
              variant="ghost"
              className="mt-6 w-full justify-start"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </aside>
          <main className="overflow-y-auto p-6">
            {activeTab === "workspace" && (
              <WorkspaceSettings
                settings={settings}
                onSettingsChange={onSettingsChange}
                projectName={projectName}
                onProjectNameChange={onProjectNameChange}
              />
            )}
            {activeTab === "users" && user.role === "ADMIN" && <UsersAdmin />}
            {activeTab === "usage" && user.role === "ADMIN" && <UsageAdmin />}
            {activeTab === "model" && user.role === "ADMIN" && (
              <ModelConfigAdmin onSettingsChange={onSettingsChange} />
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceSettings({
  settings,
  onSettingsChange,
  projectName,
  onProjectNameChange,
}: {
  settings: ImageSettings;
  onSettingsChange: (settings: ImageSettings) => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
}) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Workspace</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Project state is saved to the server. Model credentials stay in admin
          configuration.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="project-name">Project name</Label>
          <Input
            id="project-name"
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Model</Label>
          <Input value="gpt-image-2" disabled />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <SelectSetting
          label="Size"
          value={settings.size}
          values={IMAGE_SIZES}
          onValueChange={(value) =>
            onSettingsChange({ ...settings, size: value as ImageSettings["size"] })
          }
        />
        <SelectSetting
          label="Quality"
          value={settings.quality}
          values={IMAGE_QUALITIES}
          onValueChange={(value) =>
            onSettingsChange({
              ...settings,
              quality: value as ImageSettings["quality"],
            })
          }
        />
        <SelectSetting
          label="Format"
          value={settings.outputFormat}
          values={IMAGE_OUTPUT_FORMATS}
          onValueChange={(value) =>
            onSettingsChange({
              ...settings,
              outputFormat: value as ImageSettings["outputFormat"],
            })
          }
        />
      </div>
    </section>
  );
}

function SelectSetting({
  label,
  value,
  values,
  onValueChange,
}: {
  label: string;
  value: string;
  values: readonly string[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function UsersAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadUsers() {
    const response = await fetch("/api/admin/users");
    const body = await response.json();
    if (response.ok) setUsers(body.users || []);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      toast.error(body?.error || "Failed to create user");
      return;
    }
    setUsername("");
    setPassword("");
    toast.success("User created");
    await loadUsers();
  }

  async function deleteUser(userId: string) {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(body?.error || "Failed to delete user");
      return;
    }
    toast.success("User deleted");
    await loadUsers();
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Users</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Create user accounts and remove access without deleting historical
          usage.
        </p>
      </div>

      <form onSubmit={createUser} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input
          placeholder="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <Input
          placeholder="Temporary password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Button type="submit" disabled={loading}>
          <UserPlus className="h-4 w-4" />
          Create
        </Button>
      </form>

      <div className="overflow-hidden border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Username</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id} className="border-t border-neutral-200">
                <td className="px-3 py-2">{item.username}</td>
                <td className="px-3 py-2">{item.role}</td>
                <td className="px-3 py-2">{item.status}</td>
                <td className="px-3 py-2">
                  {new Date(item.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${item.username}`}
                    onClick={() => void deleteUser(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsageAdmin() {
  const [usage, setUsage] = useState<UsageRow[]>([]);

  async function loadUsage() {
    const response = await fetch("/api/admin/usage");
    const body = await response.json();
    if (response.ok) setUsage(body.usage || []);
  }

  useEffect(() => {
    void loadUsage();
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Usage</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Requests, successful generations, failures, and latest activity by
          user.
        </p>
      </div>

      <div className="overflow-hidden border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Requests</th>
              <th className="px-3 py-2 font-medium">Succeeded</th>
              <th className="px-3 py-2 font-medium">Failed</th>
              <th className="px-3 py-2 font-medium">Images</th>
              <th className="px-3 py-2 font-medium">Last used</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((row) => (
              <tr key={row.userId} className="border-t border-neutral-200">
                <td className="px-3 py-2">{row.username}</td>
                <td className="px-3 py-2">{row.requests}</td>
                <td className="px-3 py-2">{row.succeeded}</td>
                <td className="px-3 py-2">{row.failed}</td>
                <td className="px-3 py-2">{row.generatedImages}</td>
                <td className="px-3 py-2">
                  {row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ModelConfigAdmin({
  onSettingsChange,
}: {
  onSettingsChange: (settings: ImageSettings) => void;
}) {
  const [config, setConfig] = useState<ModelConfigView | null>(null);
  const [model, setModel] = useState("gpt-image-2");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [defaultOptions, setDefaultOptions] = useState(DEFAULT_IMAGE_SETTINGS);

  const loadConfig = useCallback(async () => {
    const response = await fetch("/api/admin/model-config");
    const body = await response.json();
    if (!response.ok) return;

    const nextConfig = body.config as ModelConfigView | null;
    setConfig(nextConfig);
    if (nextConfig) {
      setModel(nextConfig.model);
      setBaseUrl(nextConfig.baseUrl);
      setEnabled(nextConfig.enabled);
      setDefaultOptions(nextConfig.defaultOptions);
      onSettingsChange(nextConfig.defaultOptions);
    }
  }, [onSettingsChange]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function saveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/model-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        baseUrl,
        apiKey,
        enabled,
        defaultOptions,
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(body?.error || "Failed to save model config");
      return;
    }
    setApiKey("");
    toast.success("Model config saved");
    await loadConfig();
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Model API</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Credentials are encrypted at rest and never returned to the browser.
        </p>
      </div>

      <form onSubmit={saveConfig} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </div>
          <div className="flex items-end gap-3 pb-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span className="text-sm text-neutral-700">Enabled</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="base-url">Base URL</Label>
          <Input
            id="base-url"
            placeholder="https://api.openai.com"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="api-key">
            API key {config?.hasApiKey ? "(leave blank to keep current)" : ""}
          </Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <SelectSetting
            label="Default size"
            value={defaultOptions.size}
            values={IMAGE_SIZES}
            onValueChange={(value) =>
              setDefaultOptions({
                ...defaultOptions,
                size: value as ImageSettings["size"],
              })
            }
          />
          <SelectSetting
            label="Default quality"
            value={defaultOptions.quality}
            values={IMAGE_QUALITIES}
            onValueChange={(value) =>
              setDefaultOptions({
                ...defaultOptions,
                quality: value as ImageSettings["quality"],
              })
            }
          />
          <SelectSetting
            label="Default format"
            value={defaultOptions.outputFormat}
            values={IMAGE_OUTPUT_FORMATS}
            onValueChange={(value) =>
              setDefaultOptions({
                ...defaultOptions,
                outputFormat: value as ImageSettings["outputFormat"],
              })
            }
          />
        </div>

        <Button type="submit">Save model config</Button>
      </form>
    </section>
  );
}
