import type { CropRect, ExportSettings, Template } from '../types';

export type { Template } from '../types';

const STORAGE_KEY = 'ui-image-processor.templates.v1';

export interface TemplateDraft {
  name: string;
  crop: CropRect;
  exportSettings: ExportSettings;
  namingRule: string;
}

export interface TemplateStore {
  list(): Promise<Template[]>;
  save(template: TemplateDraft): Promise<Template>;
  remove(id: string): Promise<void>;
}

export function createMemoryTemplateStore(initialTemplates: Template[] = []): TemplateStore {
  let templates = [...initialTemplates];

  return {
    async list() {
      return [...templates];
    },
    async save(template) {
      const now = new Date().toISOString();
      const saved: Template = {
        ...template,
        id: createId(),
        createdAt: now,
        updatedAt: now
      };
      templates = [saved, ...templates];
      return saved;
    },
    async remove(id) {
      templates = templates.filter((template) => template.id !== id);
    }
  };
}

export function createLocalStorageTemplateStore(storage: Storage = window.localStorage): TemplateStore {
  return {
    async list() {
      return readTemplates(storage);
    },
    async save(template) {
      const now = new Date().toISOString();
      const saved: Template = {
        ...template,
        id: createId(),
        createdAt: now,
        updatedAt: now
      };
      writeTemplates(storage, [saved, ...readTemplates(storage)]);
      return saved;
    },
    async remove(id) {
      writeTemplates(
        storage,
        readTemplates(storage).filter((template) => template.id !== id)
      );
    }
  };
}

function readTemplates(storage: Storage): Template[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTemplates(storage: Storage, templates: Template[]) {
  storage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function createId(): string {
  return crypto.randomUUID?.() ?? `template-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
