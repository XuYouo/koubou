"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ExternalLink,
  ImageIcon,
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
  imageAssets: number;
  lastUsedAt: string | null;
};

type UsageGalleryUser = {
  id: string;
  username: string;
  imageAssets: number;
};

type UsageAsset = {
  id: string;
  type: "GENERATED" | "UPLOAD";
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  projectName: string;
  createdAt: string;
};

type ModelConfigView = {
  id: string;
  provider: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
  hasApiKey: boolean;
  updatedAt: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SafeUser;
  settings: ImageSettings;
  onSettingsChange: (settings: ImageSettings) => void;
  onLogout: () => void;
};

const navItems = [
  { id: "workspace", label: "Defaults", icon: Settings, admin: false },
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
              />
            )}
            {activeTab === "users" && user.role === "ADMIN" && <UsersAdmin />}
            {activeTab === "usage" && user.role === "ADMIN" && <UsageAdmin />}
            {activeTab === "model" && user.role === "ADMIN" && (
              <ModelConfigAdmin />
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
}: {
  settings: ImageSettings;
  onSettingsChange: (settings: ImageSettings) => void;
}) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Generation defaults</h2>
        <p className="mt-1 text-sm text-neutral-500">
          These defaults apply across projects. The prompt bar can override them
          for a single generation.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
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
  const [selectedUser, setSelectedUser] = useState<UsageGalleryUser | null>(null);
  const [assets, setAssets] = useState<UsageAsset[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryLoadingMore, setGalleryLoadingMore] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  async function loadUsage() {
    const response = await fetch("/api/admin/usage");
    const body = await response.json();
    if (response.ok) setUsage(body.usage || []);
  }

  useEffect(() => {
    void loadUsage();
  }, []);

  async function loadUserAssets(userId: string, cursor: string | null = null) {
    if (cursor) {
      setGalleryLoadingMore(true);
    } else {
      setGalleryLoading(true);
      setAssets([]);
      setNextCursor(null);
    }
    setGalleryError(null);

    const params = new URLSearchParams({ limit: "60" });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(
      `/api/admin/users/${encodeURIComponent(userId)}/assets?${params}`
    );
    const body = await response.json().catch(() => null);

    setGalleryLoading(false);
    setGalleryLoadingMore(false);

    if (!response.ok) {
      setGalleryError(body?.error || "Failed to load image assets");
      return;
    }

    const nextAssets = Array.isArray(body?.assets) ? body.assets : [];
    setAssets((current) => (cursor ? [...current, ...nextAssets] : nextAssets));
    setNextCursor(body?.nextCursor || null);
  }

  function openUserGallery(row: UsageRow) {
    setSelectedUser({
      id: row.userId,
      username: row.username,
      imageAssets: row.imageAssets,
    });
    void loadUserAssets(row.userId);
  }

  function closeUserGallery() {
    setSelectedUser(null);
    setAssets([]);
    setNextCursor(null);
    setGalleryError(null);
  }

  if (selectedUser) {
    return (
      <UsageAssetGallery
        user={selectedUser}
        assets={assets}
        nextCursor={nextCursor}
        loading={galleryLoading}
        loadingMore={galleryLoadingMore}
        error={galleryError}
        onBack={closeUserGallery}
        onLoadMore={() => void loadUserAssets(selectedUser.id, nextCursor)}
        onRetry={() => void loadUserAssets(selectedUser.id)}
      />
    );
  }

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
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => openUserGallery(row)}
                    className="rounded-sm font-medium text-neutral-950 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:outline-none"
                  >
                    {row.username}
                  </button>
                </td>
                <td className="px-3 py-2">{row.requests}</td>
                <td className="px-3 py-2">{row.succeeded}</td>
                <td className="px-3 py-2">{row.failed}</td>
                <td className="px-3 py-2">{row.imageAssets}</td>
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

function UsageAssetGallery({
  user,
  assets,
  nextCursor,
  loading,
  loadingMore,
  error,
  onBack,
  onLoadMore,
  onRetry,
}: {
  user: UsageGalleryUser;
  assets: UsageAsset[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  onBack: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  const countLabel = loading
    ? "Loading image assets..."
    : user.imageAssets === assets.length
      ? `${assets.length} image assets`
      : `Showing ${assets.length} of ${user.imageAssets} image assets`;

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to usage"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{user.username}</h2>
            <p className="mt-1 text-sm text-neutral-500">{countLabel}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded border border-neutral-200 bg-neutral-100"
            />
          ))}
        </div>
      ) : assets.length === 0 && !error ? (
        <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-neutral-300 px-6 py-10 text-center">
          <ImageIcon className="h-8 w-8 text-neutral-400" />
          <h3 className="mt-3 text-sm font-medium text-neutral-950">
            No image assets
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            Generated outputs and uploaded references will appear here.
          </p>
        </div>
      ) : (
        <div className="columns-2 gap-3 md:columns-3">
          {assets.map((asset) => (
            <a
              key={asset.id}
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className="group mb-3 block break-inside-avoid overflow-hidden rounded border border-neutral-200 bg-white transition hover:border-neutral-300"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt={`${user.username} ${formatAssetType(asset.type)} image`}
                loading="lazy"
                className="w-full bg-neutral-100 object-cover transition group-hover:opacity-90"
              />
              <div className="space-y-2 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-neutral-600">
                    {formatAssetType(asset.type)}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
                </div>
                <div className="space-y-0.5 text-xs text-neutral-500">
                  <p className="truncate text-neutral-700">{asset.projectName}</p>
                  <p>{new Date(asset.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {nextCursor && !loading && (
        <div className="flex justify-center pt-1">
          <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </section>
  );
}

function formatAssetType(type: UsageAsset["type"]) {
  return type === "GENERATED" ? "Generated" : "Upload";
}

function ModelConfigAdmin() {
  const [config, setConfig] = useState<ModelConfigView | null>(null);
  const [model, setModel] = useState("gpt-image-2");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);

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
      setApiKey("");
    }
  }, []);

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
            API key
          </Label>
          <Input
            id="api-key"
            type="password"
            placeholder={
              config?.hasApiKey
                ? "Configured - leave blank to keep current"
                : "Paste API key"
            }
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          {config?.hasApiKey && (
            <p className="text-xs text-neutral-500">
              A key is saved. Enter a new key only when you want to replace it.
            </p>
          )}
        </div>

        <Button type="submit">Save model config</Button>
      </form>
    </section>
  );
}
