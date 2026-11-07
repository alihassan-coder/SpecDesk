"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ListSkeleton } from "./panel-states";
import { useAdminResource } from "./use-admin-resource";
import { ErrorCard } from "@/components/chat/status-cards";
import { SettingRow } from "@/components/settings/setting-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { adminApi, toHumanError, type Catalog, type CatalogModel, type ModelsResponse } from "@/lib/admin-api";
import type { HumanError } from "@/lib/errors";

const DEFAULT = "__default";
const ADD = "__add";

const agentName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

/** Enabled models, plus `keep` (the current value) even if it has since been disabled. */
const choices = (models: CatalogModel[], keep?: string) => models.filter((m) => m.enabled || m.id === keep);

function ModelSelect({
  id,
  value,
  models,
  onChange,
  extra,
  placeholder,
}: {
  id: string;
  value: string;
  models: CatalogModel[];
  onChange: (v: string) => void;
  extra?: { value: string; label: string };
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full sm:w-64">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {extra && <SelectItem value={extra.value}>{extra.label}</SelectItem>}
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ModelsPanel() {
  const { state, retry, setData } = useAdminResource(adminApi.models);
  if (state.status === "ready") return <ModelsEditor data={state.data} onSaved={(res) => setData(() => res)} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI models</CardTitle>
        <CardDescription>Which model each agent uses.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === "loading" ? <ListSkeleton label="Loading models" /> : <ErrorCard error={state.error} onRetry={retry} />}
      </CardContent>
    </Card>
  );
}

function ModelsEditor({ data, onSaved }: { data: ModelsResponse; onSaved: (res: ModelsResponse) => void }) {
  const [draft, setDraft] = useState<Catalog | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<HumanError | null>(null);

  const catalog = draft ?? data.catalog;
  const labelOf = (id: string) => catalog.models.find((m) => m.id === id)?.label ?? id;
  const edit = (update: (c: Catalog) => Catalog) => {
    setDraft(update(catalog));
    setSaveError(null);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      onSaved(await adminApi.saveModels(draft));
      setDraft(null);
      toast.success("Models saved", { description: "New agent runs use these models right away." });
    } catch (e) {
      setSaveError(toHumanError(e));
    } finally {
      setSaving(false);
    }
  };

  const setAgentModel = (agent: string, value: string) =>
    edit((c) => {
      const agentModels = { ...c.agent_models };
      if (value === DEFAULT) delete agentModels[agent];
      else agentModels[agent] = value;
      return { ...c, agent_models: agentModels };
    });

  const addable = choices(catalog.models).filter((m) => m.id !== catalog.default_model && !catalog.fallback_models.includes(m.id));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Model per agent</CardTitle>
          <CardDescription>Agents without an override use the default model.</CardDescription>
          {data.isDefault && !draft && (
            <CardAction>
              <Badge variant="outline">Built-in defaults</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SettingRow id="model-default" title="Default model" description="Used by every agent unless overridden">
              <ModelSelect
                id="model-default"
                value={catalog.default_model}
                models={choices(catalog.models, catalog.default_model)}
                onChange={(v) => edit((c) => ({ ...c, default_model: v }))}
              />
            </SettingRow>
            {data.agents.map((agent) => (
              <div key={agent} className="contents">
                <FieldSeparator />
                <SettingRow id={`model-${agent}`} title={agentName(agent)}>
                  <ModelSelect
                    id={`model-${agent}`}
                    value={catalog.agent_models[agent] ?? DEFAULT}
                    models={choices(catalog.models, catalog.agent_models[agent])}
                    extra={{ value: DEFAULT, label: `Default (${labelOf(catalog.default_model)})` }}
                    onChange={(v) => setAgentModel(agent, v)}
                  />
                </SettingRow>
              </div>
            ))}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fallbacks</CardTitle>
          <CardDescription>Tried in order when a model fails or is busy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {catalog.fallback_models.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fallbacks. If a model fails, the agent run fails.</p>
          ) : (
            <ol className="space-y-2">
              {catalog.fallback_models.map((id, i) => (
                <li key={id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{labelOf(id)}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${labelOf(id)} from fallbacks`}
                    onClick={() => edit((c) => ({ ...c, fallback_models: c.fallback_models.filter((f) => f !== id) }))}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ol>
          )}
          {addable.length > 0 && (
            <ModelSelect
              id="model-fallback-add"
              value={ADD}
              models={addable}
              extra={{ value: ADD, label: "Add a fallback…" }}
              onChange={(v) => v !== ADD && edit((c) => ({ ...c, fallback_models: [...c.fallback_models, v] }))}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available models</CardTitle>
          <CardDescription>Turn a model off to hide it from every select. Prices are USD per 1M tokens.</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup className="rounded-lg border">
            {catalog.models.map((m, i) => (
              <div key={m.id} className="contents">
                {i > 0 && <ItemSeparator />}
                <Item className="flex-wrap">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="flex-wrap">
                      {m.label}
                      {m.capabilities.thinking && <Badge variant="outline">Thinking</Badge>}
                      {m.capabilities.structured_output && <Badge variant="outline">Structured</Badge>}
                      {m.capabilities.web_search && <Badge variant="outline">Web search</Badge>}
                    </ItemTitle>
                    <ItemDescription className="truncate">
                      <span className="font-mono">{m.id}</span> · ${m.price.input} in / ${m.price.output} out
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Switch
                      checked={m.enabled}
                      aria-label={`${m.enabled ? "Disable" : "Enable"} ${m.label}`}
                      onCheckedChange={(on) =>
                        edit((c) => ({ ...c, models: c.models.map((x) => (x.id === m.id ? { ...x, enabled: on } : x)) }))
                      }
                    />
                  </ItemActions>
                </Item>
              </div>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {saveError && <ErrorCard error={saveError} />}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void save()} disabled={!draft || saving}>
            {saving && <Spinner />} Save models
          </Button>
          {draft && (
            <Button
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setDraft(null);
                setSaveError(null);
              }}
            >
              Discard changes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
